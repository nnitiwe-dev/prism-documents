from __future__ import annotations

from prism_backend.services import settings_store


def test_defaults_present():
    s = settings_store.load()
    assert "default_ocr_engine" in s and "warn_unrecommended" in s


def test_save_roundtrip_and_key_filtering(tmp_path, monkeypatch):
    monkeypatch.setattr(settings_store, "SETTINGS_DIR", tmp_path)
    monkeypatch.setattr(settings_store, "SETTINGS_PATH", tmp_path / "settings.json")
    out = settings_store.save({"default_model": "qwen2.5-0.5b", "bogus": "nope"})
    assert out["default_model"] == "qwen2.5-0.5b"
    assert "bogus" not in out
    assert settings_store.load()["default_model"] == "qwen2.5-0.5b"
