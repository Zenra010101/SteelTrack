"""Versioned on-disk registry for trained model artifacts.

Layout under MODEL_DIR:

    models/
      latest.json                       # pointer to the current version
      v0.1.0-20260101T120000Z/
        manifest.json                   # metadata: scope, metrics, created_at
        {product_id}__{branch_id}.pt   # per-series state_dict + scaler params

The registry is intentionally filesystem-backed for the MVP. Swapping in
S3/Azure Blob + MLflow later only requires reimplementing the four
methods below — nothing else in the codebase touches storage directly.
"""

from __future__ import annotations

import json
import re
import shutil
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import torch

_SERIES_FILE_RE = re.compile(r"^(?P<product>[0-9a-zA-Z_\-]+)__(?P<branch>[0-9a-zA-Z_\-]+)\.pt$")


def _parse_id(val: Any) -> UUID | str:
    """Parse string or UUID, preserving UUID type if valid."""
    if isinstance(val, UUID):
        return val
    try:
        return UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return str(val)


@dataclass
class SeriesArtifact:
    """Everything needed to reproduce a prediction for one series."""

    product_id: UUID | str
    branch_id: UUID | str
    state_dict: dict
    scaler_center: float
    scaler_scale: float
    lookback_months: int
    horizon_months: int
    seq_len: int = 12
    input_mean: float = 0.0
    input_std: float = 1.0
    last_trained_at: str = ""
    metrics: dict = field(default_factory=dict)

    def to_payload(self) -> dict:
        return {
            "product_id": str(self.product_id),
            "branch_id": str(self.branch_id),
            "state_dict": self.state_dict,
            "scaler_center": self.scaler_center,
            "scaler_scale": self.scaler_scale,
            "lookback_months": self.lookback_months,
            "horizon_months": self.horizon_months,
            "seq_len": self.seq_len,
            "input_mean": self.input_mean,
            "input_std": self.input_std,
            "last_trained_at": self.last_trained_at,
            "metrics": self.metrics,
        }

    @staticmethod
    def from_payload(payload: dict) -> SeriesArtifact:
        return SeriesArtifact(
            product_id=_parse_id(payload["product_id"]),
            branch_id=_parse_id(payload["branch_id"]),
            state_dict=payload["state_dict"],
            scaler_center=float(payload["scaler_center"]),
            scaler_scale=float(payload["scaler_scale"]),
            lookback_months=int(payload["lookback_months"]),
            horizon_months=int(payload["horizon_months"]),
            seq_len=int(payload.get("seq_len", 12)),
            input_mean=float(payload.get("input_mean", 0.0)),
            input_std=float(payload.get("input_std", 1.0)),
            last_trained_at=payload.get("last_trained_at", ""),
            metrics=payload.get("metrics", {}),
        )


class ModelRegistry:
    """Filesystem-backed store of trained model artifacts."""

    def __init__(self, model_dir: str | Path) -> None:
        self.root = Path(model_dir)
        self.root.mkdir(parents=True, exist_ok=True)
        self._latest_pointer = self.root / "latest.json"

    # ------------------------------------------------------------------
    # Versioning
    # ------------------------------------------------------------------
    @staticmethod
    def new_version(prefix: str = "v0.1.0") -> str:
        """Generate a sortable version string: v0.1.0-20260101T120000Z."""
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        return f"{prefix}-{stamp}"

    def version_dir(self, version: str) -> Path:
        return self.root / version

    def list_versions(self) -> list[str]:
        """Return all stored versions, newest first."""
        versions = [
            p.name
            for p in self.root.iterdir()
            if p.is_dir() and (p / "manifest.json").exists()
        ]
        return sorted(versions, reverse=True)

    def latest_version(self) -> str | None:
        """Return the version pointed to by latest.json, if any."""
        if not self._latest_pointer.exists():
            # Fall back to the newest directory on disk.
            versions = self.list_versions()
            return versions[0] if versions else None

        try:
            data = json.loads(self._latest_pointer.read_text(encoding="utf-8"))
            version = data.get("version")
        except (json.JSONDecodeError, OSError):
            return None

        if version and self.version_dir(version).exists():
            return version
        versions = self.list_versions()
        return versions[0] if versions else None

    def set_latest(self, version: str) -> None:
        """Point latest.json at the given version."""
        self._latest_pointer.write_text(
            json.dumps({"version": version, "updated_at": datetime.now(UTC).isoformat()}, indent=2),
            encoding="utf-8",
        )

    # ------------------------------------------------------------------
    # Artifact I/O
    # ------------------------------------------------------------------
    def save_artifact(self, version: str, artifact: SeriesArtifact) -> Path:
        """Persist a single series artifact under the given version."""
        target_dir = self.version_dir(version)
        target_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{artifact.product_id}__{artifact.branch_id}.pt"
        path = target_dir / filename
        torch.save(artifact.to_payload(), path)
        return path

    def load_artifact(self, version: str, product_id: UUID | str, branch_id: UUID | str) -> SeriesArtifact | None:
        """Load one series artifact, or None if it does not exist."""
        path = self.version_dir(version) / f"{product_id}__{branch_id}.pt"
        if not path.exists():
            return None
        payload = torch.load(path, map_location="cpu", weights_only=False)
        return SeriesArtifact.from_payload(payload)

    def load_version_artifacts(self, version: str) -> dict[tuple[UUID | str, UUID | str], SeriesArtifact]:
        """Load every artifact in a version, keyed by (product_id, branch_id)."""
        target_dir = self.version_dir(version)
        if not target_dir.exists():
            return {}

        artifacts: dict[tuple[UUID | str, UUID | str], SeriesArtifact] = {}
        for path in target_dir.glob("*.pt"):
            match = _SERIES_FILE_RE.match(path.name)
            if not match:
                continue
            payload = torch.load(path, map_location="cpu", weights_only=False)
            artifact = SeriesArtifact.from_payload(payload)
            artifacts[(artifact.product_id, artifact.branch_id)] = artifact
        return artifacts

    def series_keys(self, version: str) -> list[tuple[UUID | str, UUID | str]]:
        """List the (product_id, branch_id) pairs available in a version."""
        return list(self.load_version_artifacts(version).keys())

    # ------------------------------------------------------------------
    # Manifest
    # ------------------------------------------------------------------
    def write_manifest(self, version: str, manifest: dict) -> Path:
        """Write the version's manifest describing scope and training metrics."""
        target_dir = self.version_dir(version)
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / "manifest.json"
        path.write_text(json.dumps(manifest, indent=2, default=str), encoding="utf-8")
        return path

    def read_manifest(self, version: str) -> dict | None:
        path = self.version_dir(version) / "manifest.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    # ------------------------------------------------------------------
    # Maintenance
    # ------------------------------------------------------------------
    def prune(self, keep: int = 5) -> list[str]:
        """Delete all but the `keep` newest versions. Returns removed versions."""
        versions = self.list_versions()
        removed: list[str] = []
        for version in versions[keep:]:
            shutil.rmtree(self.version_dir(version), ignore_errors=True)
            removed.append(version)
        return removed
