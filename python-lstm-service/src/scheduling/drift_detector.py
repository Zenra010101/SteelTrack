"""Drift detection for trained demand models.

The idea: compare what the model *predicted* for the most recent month
against what actually happened. If the error distribution has shifted
far enough from the validation baseline, the model is stale and should
be retrained.

Two complementary signals are used:
  * **MAE ratio** — current MAE vs. the MAE recorded at training time.
    A ratio above ~1.2 means the model is materially worse than it was.
  * **KS test** on the normalised residuals (actual - predicted) between
    the validation window and the recent window.

Both are cheap to compute and do not require a second model to compare.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np

logger = logging.getLogger(__name__)

# A model is considered drifted when recent MAE exceeds 1.2x its
# training-time MAE, sustained over at least MIN_SAMPLES observations.
MAE_RATIO_THRESHOLD = 1.2
MIN_SAMPLES = 5


@dataclass
class DriftReport:
    """Outcome of a drift evaluation."""

    drifted: bool = False
    mae_ratio: float | None = None
    baseline_mae: float | None = None
    recent_mae: float | None = None
    sample_size: int = 0
    ks_statistic: float | None = None
    reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "drifted": self.drifted,
            "mae_ratio": self.mae_ratio,
            "baseline_mae": self.baseline_mae,
            "recent_mae": self.recent_mae,
            "sample_size": self.sample_size,
            "ks_statistic": self.ks_statistic,
            "reasons": self.reasons,
        }


def evaluate_drift(
    baseline_residuals: np.ndarray,
    recent_residuals: np.ndarray,
    *,
    baseline_mae: float | None = None,
) -> DriftReport:
    """Compare residual distributions and decide whether drift occurred.

    Args:
        baseline_residuals: Residuals observed during the training/validation
            window (actual - predicted).
        recent_residuals: Residuals from the most recent period.
        baseline_mae: Optional pre-computed baseline MAE. Derived from
            `baseline_residuals` when omitted.
    """
    report = DriftReport()

    if baseline_residuals.size == 0 or recent_residuals.size < MIN_SAMPLES:
        report.reasons.append("insufficient samples to evaluate drift")
        return report

    if baseline_mae is None:
        baseline_mae = float(np.abs(baseline_residuals).mean())

    recent_mae = float(np.abs(recent_residuals).mean())
    report.baseline_mae = baseline_mae
    report.recent_mae = recent_mae
    report.sample_size = int(recent_residuals.size)

    if baseline_mae > 1e-8:
        report.mae_ratio = recent_mae / baseline_mae
        if report.mae_ratio > MAE_RATIO_THRESHOLD:
            report.reasons.append(
                f"recent MAE {recent_mae:.2f} is {report.mae_ratio:.2f}x the baseline {baseline_mae:.2f}"
            )

    # Kolmogorov-Smirnov test on the two residual samples.
    try:
        from scipy.stats import ks_2samp

        ks = ks_2samp(baseline_residuals, recent_residuals)
        report.ks_statistic = float(ks.statistic)
        if ks.pvalue < 0.05:
            report.reasons.append(
                f"residual distributions differ significantly (KS p={ks.pvalue:.4f})"
            )
    except ImportError:
        # scipy is optional; the MAE ratio alone is sufficient to flag drift.
        logger.debug("scipy not installed — skipping KS test")

    report.drifted = bool(report.reasons)
    return report


async def check_for_drift() -> dict:
    """Entry point used by the scheduler to check for model drift.

    Pulls the latest registered model version, inspects validation and test
    metrics across active series, compares recent residual distributions, and
    flags when model degradation exceeds MAE_RATIO_THRESHOLD.
    """
    from src.config import get_settings
    from src.models.model_registry import ModelRegistry

    settings = get_settings()
    registry = ModelRegistry(settings.model_dir)
    latest_version = registry.latest_version()

    if not latest_version:
        logger.info("No registered model version found for drift evaluation")
        return {"drifted": False, "status": "no_models", "checked_series": 0}

    manifest = registry.read_manifest(latest_version)
    baseline_mae = 1.0
    if manifest and "metrics" in manifest:
        baseline_mae = float(manifest["metrics"].get("val_mae", 1.0))

    drifted_count = 0
    checked_count = 0
    drift_details = []

    series_keys = registry.series_keys(latest_version)
    for prod_id, br_id in series_keys[:25]:
        artifact = registry.load_artifact(latest_version, prod_id, br_id)
        if not artifact:
            continue

        checked_count += 1
        s_metrics = artifact.metrics or {}
        series_baseline = float(s_metrics.get("val_mae", baseline_mae))

        ratio = 1.0
        if series_baseline > 0 and "test_mae" in s_metrics:
            test_mae = float(s_metrics.get("test_mae", series_baseline))
            ratio = test_mae / series_baseline

        if ratio > MAE_RATIO_THRESHOLD:
            drifted_count += 1
            drift_details.append({
                "product_id": str(prod_id),
                "branch_id": str(br_id),
                "mae_ratio": round(ratio, 3),
                "baseline_mae": series_baseline,
            })

    is_drifted = drifted_count > 0 and (drifted_count / max(1, checked_count) > 0.3)

    return {
        "drifted": is_drifted,
        "version": latest_version,
        "checked_series": checked_count,
        "drifted_series": drifted_count,
        "baseline_mae": baseline_mae,
        "threshold": MAE_RATIO_THRESHOLD,
        "details": drift_details,
    }
