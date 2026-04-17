"""
Weather API helpers for live historical and forecast data.

Uses Open-Meteo so runtime weather comes from an API rather than training CSVs.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import urlopen

BENGALURU_LATITUDE = 12.9716
BENGALURU_LONGITUDE = 77.5946
HOT_DAY_THRESHOLD = 30.0
REQUEST_TIMEOUT_SECONDS = 30


class WeatherApiError(RuntimeError):
    """Raised when live weather data could not be fetched."""


def _fetch_json(base_url: str, params: dict) -> dict:
    query = urlencode(params)
    url = f"{base_url}?{query}"

    try:
        with urlopen(url, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise WeatherApiError(f"Weather API request failed: {url}") from exc


def _build_rows(payload: dict) -> list[dict]:
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    temperatures = daily.get("temperature_2m_max") or []

    if len(dates) != len(temperatures):
        raise WeatherApiError("Weather API returned inconsistent daily arrays.")

    rows = []
    for idx, iso_date in enumerate(dates):
        current_day = date.fromisoformat(iso_date)
        temperature = float(temperatures[idx])
        rows.append({
            "date": iso_date,
            "day_of_week": current_day.strftime("%A"),
            "temperature": temperature,
            "hot_day": 1 if temperature >= HOT_DAY_THRESHOLD else 0,
        })
    return rows


def fetch_historical_weather(start_date: date, end_date: date) -> list[dict]:
    """Fetch observed daily weather for the supplied historical date window."""
    if start_date > end_date:
        return []

    payload = _fetch_json(
        "https://archive-api.open-meteo.com/v1/archive",
        {
            "latitude": BENGALURU_LATITUDE,
            "longitude": BENGALURU_LONGITUDE,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": "temperature_2m_max",
            "timezone": "Asia/Kolkata",
        },
    )
    return _build_rows(payload)


def fetch_forecast_weather(start_date: date, days: int = 7) -> list[dict]:
    """Fetch forecast daily weather beginning on start_date."""
    if days <= 0:
        return []

    end_date = start_date + timedelta(days=days - 1)
    payload = _fetch_json(
        "https://api.open-meteo.com/v1/forecast",
        {
            "latitude": BENGALURU_LATITUDE,
            "longitude": BENGALURU_LONGITUDE,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": "temperature_2m_max",
            "timezone": "Asia/Kolkata",
        },
    )
    return _build_rows(payload)
