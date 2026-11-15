import os

from tests.firma import SECRET

os.environ["PEY_API_KEY"] = "test-key"
os.environ["PEY_BASE_URL"] = "https://api.pey.mx"
os.environ["PEY_WEBHOOK_SECRET"] = SECRET
os.environ["PEY_WEBHOOK_INSECURE"] = "0"
os.environ["PANEL_KEY"] = "k-test"
os.environ["OWNER_PHONES"] = "5511111111"
os.environ["PUBLIC_BASE_URL"] = "http://test"
os.environ["APP_DISABLE_TASKS"] = "1"
os.environ["LLM_API_KEY"] = ""
os.environ["WHATSAPP_TOKEN"] = ""

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _db(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "app.db"))
    monkeypatch.setenv("LLM_API_KEY", "")
    monkeypatch.setenv("PEY_WEBHOOK_INSECURE", "0")
    monkeypatch.setenv("APP_DISABLE_TASKS", "1")
    from app.db import init_db

    init_db()


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c

