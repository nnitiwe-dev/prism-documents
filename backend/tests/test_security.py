from __future__ import annotations


def test_capabilities_requires_token(client):
    assert client.get("/capabilities").status_code == 401


def test_wrong_token_rejected(client):
    r = client.get("/capabilities", headers={"X-Prism-Token": "wrong"})
    assert r.status_code == 401


def test_pdf_requires_token(client, sample_pdf):
    r = client.post("/pdf/info", json={"path": sample_pdf})
    assert r.status_code == 401


def test_correct_token_accepted(client, auth):
    assert client.get("/capabilities", headers=auth).status_code == 200
