"""Shared test setup: every test starts with empty rate-limit counters."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.rate_limit import AGENT_LIMITER, EXTRACT_LIMITER  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    AGENT_LIMITER.reset()
    EXTRACT_LIMITER.reset()
    yield
