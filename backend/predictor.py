from datetime import datetime, timedelta

import pandas as pd
from prophet import Prophet

from database import get_all_events

MIN_EVENTS = 10

_cache: dict = {}

def get_prediction() -> dict:
    global _cache
    now = datetime.now()
    if _cache and (now - _cache["ts"]) < timedelta(minutes=30):
        return _cache["result"]
    result = _compute_prediction()
    if result.get("error") is None:
        _cache = {"ts": now, "result": result}
    return result

def _compute_prediction() -> dict:
    rows = get_all_events()

    if len(rows) < MIN_EVENTS:
        return {
            "error": f"Données insuffisantes — {len(rows)}/{MIN_EVENTS} événements enregistrés.",
            "forecast": []
        }

    df = pd.DataFrame(rows, columns=["ds", "y"])
    df["ds"] = pd.to_datetime(df["ds"])
    df = df.set_index("ds").resample("h").mean().reset_index()
    df = df.dropna()

    if len(df) < 2:
        return {
            "error": "Données insuffisantes après agrégation horaire.",
            "forecast": []
        }

    model = Prophet(
        daily_seasonality=True,
        weekly_seasonality=len(df) >= 24 * 7,
        yearly_seasonality=False
    )
    model.fit(df)

    future   = model.make_future_dataframe(periods=24, freq="h")
    forecast = model.predict(future)

    result = (
        forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]]
        .tail(24)
        .assign(
            ds         = lambda x: x["ds"].dt.strftime("%Y-%m-%dT%H:%M:%S"),
            yhat       = lambda x: x["yhat"].clip(lower=0).round(1),
            yhat_lower = lambda x: x["yhat_lower"].clip(lower=0).round(1),
            yhat_upper = lambda x: x["yhat_upper"].clip(lower=0).round(1),
        )
        .to_dict(orient="records")
    )

    return {"error": None, "forecast": result}
