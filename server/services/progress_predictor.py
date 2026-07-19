"""Progress prediction — sklearn-based linear regression on user score history.

Given a user's past `confidenceScore`s (one per practice session), we fit
a small `LinearRegression` model and project forward 1-4 weeks. The
prediction is what confidence score the user is on track to hit if they
keep practicing at their current cadence.

This is intentionally simple:
  * Linear regression on session-index -> score.
  * We cap projections to [0, 100].
  * We mark a confidence bucket (low / medium / high) based on the
    number of sessions used for training.
  * We also do a CEFR mapping so the UI can show "B2 in 3 weeks".

If the user has fewer than 3 sessions we return a degenerate response
("insufficient data") instead of fabricating a trend.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Sequence

logger = logging.getLogger(__name__)

# Lazy sklearn import — keeps cold-start fast and lets the rest of the
# app boot even if scikit-learn is missing.
try:  # pragma: no cover
    from sklearn.linear_model import LinearRegression  # type: ignore
    _SKLEARN_OK = True
except Exception:  # pragma: no cover
    LinearRegression = None  # type: ignore
    _SKLEARN_OK = False


# ---- CEFR mapping -----------------------------------------------------------
# Confidence score (0-100) -> CEFR level. Anchored to widely used
# conversion tables (Pearson / Cambridge).
_CEFR_LEVELS = [
    (0, 20, "A1", "Beginner"),
    (20, 40, "A2", "Elementary"),
    (40, 60, "B1", "Intermediate"),
    (60, 80, "B2", "Upper-Intermediate"),
    (80, 95, "C1", "Advanced"),
    (95, 101, "C2", "Proficient"),
]


def _score_to_cefr(score: float) -> Dict[str, str]:
    """Map a 0-100 score to a CEFR level + friendly label."""
    score = max(0.0, min(100.0, float(score)))
    for lo, hi, level, label in _CEFR_LEVELS:
        if lo <= score < hi:
            return {"level": level, "label": label}
    return {"level": "C2", "label": "Proficient"}


# ---- Forecasting ------------------------------------------------------------
@dataclass
class Forecast:
    """Output of `predict_progress`."""
    current_score: float
    current_cefr: Dict[str, str]
    next_week_score: float
    next_week_cefr: Dict[str, str]
    target_score: float
    target_cefr: Dict[str, str]
    weeks_to_target: Optional[int]
    slope_per_session: float
    confidence: str
    sessions_used: int
    projection_series: List[Dict[str, Any]]
    summary: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "currentScore": round(self.current_score, 1),
            "currentCefr": self.current_cefr,
            "nextWeekScore": round(self.next_week_score, 1),
            "nextWeekCefr": self.next_week_cefr,
            "targetScore": round(self.target_score, 1),
            "targetCefr": self.target_cefr,
            "weeksToTarget": self.weeks_to_target,
            "slopePerSession": round(self.slope_per_session, 3),
            "confidence": self.confidence,
            "sessionsUsed": self.sessions_used,
            "projection": self.projection_series,
            "summary": self.summary,
        }


def _linear_regression_fallback(
    xs: Sequence[int], ys: Sequence[float]
) -> Optional[List[float]]:
    """Closed-form OLS for the (xs, ys) regression line.

    Returns [slope, intercept] or None on degenerate input. Used when
    sklearn isn't installed.
    """
    if len(xs) < 2:
        return None
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return None
    slope = num / den
    intercept = my - slope * mx
    return [slope, intercept]


def _fit_slope(session_scores: Sequence[float]) -> Optional[List[float]]:
    """Fit y = slope*x + intercept on session index. Returns [slope, intercept]."""
    xs = list(range(len(session_scores)))
    ys = [float(s) for s in session_scores]
    if _SKLEARN_OK:
        try:
            import numpy as np  # local import to avoid hard dep at import time
            X = np.array(xs, dtype=float).reshape(-1, 1)
            y = np.array(ys, dtype=float)
            model = LinearRegression()
            model.fit(X, y)
            return [float(model.coef_[0]), float(model.intercept_)]
        except Exception as exc:
            logger.warning("progress_predictor: sklearn fit failed, falling back: %s", exc)
    return _linear_regression_fallback(xs, ys)


def predict_progress(
    session_scores: Sequence[float],
    *,
    target_score: float = 80.0,
    sessions_per_week: float = 3.0,
    weeks_ahead: int = 4,
) -> Forecast:
    """Project the user's score forward `weeks_ahead` weeks.

    `session_scores` is the chronological list of `confidenceScore`
    values from the user's past practice sessions.
    `target_score` is the threshold we ask "how many weeks to reach?".
    """
    if not session_scores:
        return Forecast(
            current_score=0.0,
            current_cefr=_score_to_cefr(0.0),
            next_week_score=0.0,
            next_week_cefr=_score_to_cefr(0.0),
            target_score=target_score,
            target_cefr=_score_to_cefr(target_score),
            weeks_to_target=None,
            slope_per_session=0.0,
            confidence="insufficient-data",
            sessions_used=0,
            projection_series=[],
            summary="No practice sessions yet. Start speaking to unlock a progress forecast.",
        )

    current = float(session_scores[-1])
    current_cefr = _score_to_cefr(current)

    if len(session_scores) < 3:
        # Not enough points for a stable trend line.
        return Forecast(
            current_score=current,
            current_cefr=current_cefr,
            next_week_score=min(100.0, max(0.0, current + 1.5)),
            next_week_cefr=_score_to_cefr(min(100.0, current + 1.5)),
            target_score=target_score,
            target_cefr=_score_to_cefr(target_score),
            weeks_to_target=None,
            slope_per_session=0.0,
            confidence="low",
            sessions_used=len(session_scores),
            projection_series=[],
            summary=(
                f"Only {len(session_scores)} session(s) on record. "
                f"Keep practicing — we need at least 3 to forecast a trend."
            ),
        )

    fit = _fit_slope(session_scores)
    if fit is None:
        slope, intercept = 0.0, current
    else:
        slope, intercept = fit

    # Cap unreasonable slopes. A 30-point jump per session is almost
    # always a model artifact (zero practice history), not real growth.
    slope = max(min(slope, 5.0), -2.0)

    # Project forward.
    sessions_ahead = max(1, int(round(sessions_per_week * weeks_ahead)))
    projection_series: List[Dict[str, Any]] = []
    next_week_proj = None
    for w in range(1, weeks_ahead + 1):
        nxt = max(0.0, min(100.0, intercept + slope * (len(session_scores) - 1 + sessions_per_week * w)))
        projection_series.append({
            "weeksAhead": w,
            "score": round(nxt, 1),
            "cefr": _score_to_cefr(nxt),
        })
        if w == 1:
            next_week_proj = nxt

    # Weeks-to-target: solve slope * n_sessions = (target - current).
    weeks_to_target: Optional[int] = None
    if slope > 0.05 and current < target_score:
        sessions_needed = math.ceil((target_score - current) / max(slope, 0.01))
        weeks_to_target = max(1, int(math.ceil(sessions_needed / max(sessions_per_week, 0.5))))
    elif current >= target_score:
        weeks_to_target = 0  # already there
    else:
        weeks_to_target = None  # flat or declining — no ETA

    # Confidence label: more sessions = more confidence in the trend.
    if len(session_scores) >= 15:
        confidence = "high"
    elif len(session_scores) >= 7:
        confidence = "medium"
    else:
        confidence = "low"

    target_cefr = _score_to_cefr(target_score)
    if weeks_to_target is None:
        weeks_phrase = "no clear ETA yet"
    elif weeks_to_target == 0:
        weeks_phrase = "already there"
    elif weeks_to_target == 1:
        weeks_phrase = "in 1 week"
    else:
        weeks_phrase = f"in {weeks_to_target} weeks"

    summary = (
        f"Currently at {current:.0f} ({current_cefr['level']}). "
        f"Trending {'up' if slope > 0.05 else 'flat' if slope > -0.05 else 'down'} "
        f"({slope:+.2f} pts / session). On track for "
        f"{target_cefr['level']} {weeks_phrase}."
    )

    return Forecast(
        current_score=current,
        current_cefr=current_cefr,
        next_week_score=next_week_proj if next_week_proj is not None else current,
        next_week_cefr=_score_to_cefr(next_week_proj) if next_week_proj is not None else current_cefr,
        target_score=target_score,
        target_cefr=target_cefr,
        weeks_to_target=weeks_to_target,
        slope_per_session=slope,
        confidence=confidence,
        sessions_used=len(session_scores),
        projection_series=projection_series,
        summary=summary,
    )
