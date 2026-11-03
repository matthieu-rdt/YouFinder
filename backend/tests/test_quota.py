from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest

from app.errors import SearchError
from app.quota import DailyQuota


def test_persistence_and_paris_midnight(tmp_path):
    path = tmp_path / "counter.json"
    # 22:59 UTC en novembre = 23:59 à Paris.
    before = datetime(2026, 11, 2, 22, 59, tzinfo=timezone.utc)
    after = datetime(2026, 11, 2, 23, 0, tzinfo=timezone.utc)
    assert DailyQuota(path, 1).reserve(before) == 0
    with pytest.raises(SearchError) as error:
        DailyQuota(path, 1).reserve(before)
    assert error.value.code == "daily_limit_reached"
    assert DailyQuota(path, 1).reserve(after) == 0


def test_concurrent_reservations_do_not_exceed_limit(tmp_path):
    def reserve(_):
        try:
            DailyQuota(tmp_path / "counter.json", 20).reserve()
            return True
        except SearchError as error:
            assert error.code == "daily_limit_reached"
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        assert sum(pool.map(reserve, range(40))) == 20


def test_storage_error_blocks_search(tmp_path):
    path = tmp_path / "not-a-directory"
    path.write_text("occupied")
    with pytest.raises(SearchError) as error:
        DailyQuota(path / "counter.json", 20).reserve()
    assert error.value.code == "quota_storage_unavailable"
