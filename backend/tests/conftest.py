from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from prism_backend.app import create_app
from prism_backend.config import TOKEN_HEADER, load_settings

TEST_TOKEN = "test-token-123"


def _make_pdf(path, pages: int) -> str:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=200, height=280)
    with open(path, "wb") as f:
        writer.write(f)
    return str(path)


@pytest.fixture
def sample_pdf(tmp_path):
    return _make_pdf(tmp_path / "sample.pdf", 5)


@pytest.fixture
def second_pdf(tmp_path):
    return _make_pdf(tmp_path / "second.pdf", 3)


@pytest.fixture
def make_pdf(tmp_path):
    def _factory(name: str, pages: int) -> str:
        return _make_pdf(tmp_path / name, pages)

    return _factory


@pytest.fixture
def client():
    settings = load_settings()
    settings.token = TEST_TOKEN
    app = create_app(settings)
    return TestClient(app)


@pytest.fixture
def auth():
    return {TOKEN_HEADER: TEST_TOKEN}
