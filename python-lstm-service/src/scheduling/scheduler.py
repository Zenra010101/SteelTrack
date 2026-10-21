"""Background scheduling for nightly retraining and drift checks.

Uses APScheduler's AsyncIOScheduler so jobs run on the same event loop
as the FastAPI app (no thread-pool hand-off needed for I/O-bound work).

Jobs registered here:
  * `nightly_retrain`  — retrains models whose series look stale.
  * `drift_check`     — compares recent actuals against the last forecast
                        and logs/raises when the error drifts beyond tolerance.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from src.config import get_settings

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    """Return (and lazily create) the process-wide scheduler."""
    global _scheduler

    if _scheduler is None:
        settings = get_settings()
        _scheduler = AsyncIOScheduler(timezone="UTC")

        if settings.enable_scheduler:
            _scheduler.add_job(
                run_nightly_retrain,
                CronTrigger(hour=settings.nightly_retrain_hour, minute=15, timezone="UTC"),
                id="nightly_retrain",
                replace_existing=True,
                misfire_grace_time=3600,
            )

            # Drift check runs an hour after retraining, on the hour.
            _scheduler.add_job(
                run_drift_check,
                CronTrigger(hour=(settings.nightly_retrain_hour + 1) % 24, minute=30, timezone="UTC"),
                id="drift_check",
                replace_existing=True,
                misfire_grace_time=3600,
            )

    return _scheduler


def stop_scheduler(scheduler: AsyncIOScheduler | None = None) -> None:
    """Shut down the scheduler if it is running."""
    target = scheduler or _scheduler
    if target is not None and target.running:
        target.shutdown(wait=False)
        logger.info("LSTM scheduler stopped")


async def run_nightly_retrain() -> None:
    """Nightly job: retrain models for all active products and branches.

    The heavy lifting lives in `src.training.pipeline`; Phase 4 fills in
    the real implementation. Until then this logs a no-op so the
    scheduler wiring is exercised end-to-end.
    """
    logger.info("nightly_retrain job fired")
    try:
        from src.training.pipeline import retrain_all

        summary = await retrain_all()
        logger.info("nightly_retrain complete: %s", summary)
    except NotImplementedError:
        logger.info("nightly_retrain: training pipeline not implemented yet (Phase 4) — skipping")
    except Exception:
        logger.exception("nightly_retrain failed")


async def run_drift_check() -> None:
    """Hourly job: compare the latest actuals against the stored forecast.

    A sustained MAE increase beyond tolerance means the world changed
    and the model needs retraining or re-tuning.
    """
    logger.info("drift_check job fired")
    try:
        from src.scheduling.drift_detector import check_for_drift

        report = await check_for_drift()
        if report.get("drifted"):
            logger.warning("Model drift detected: %s", report)
    except NotImplementedError:
        logger.info("drift_check: drift detector not implemented yet (Phase 6) — skipping")
    except Exception:
        logger.exception("drift_check failed")
