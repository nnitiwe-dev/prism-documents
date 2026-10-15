from __future__ import annotations


def test_health_no_auth(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_capabilities(client, auth):
    r = client.get("/capabilities", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert {"version", "categories", "tools"} <= data.keys()
    assert any(t["id"] == "merge" for t in data["tools"])


def test_hardware(client, auth):
    r = client.get("/system/hardware", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert data["ram_total_bytes"] > 0
    assert data["cpu_cores_logical"] >= 1


def test_info_endpoint(client, auth, sample_pdf):
    r = client.post("/pdf/info", headers=auth, json={"path": sample_pdf})
    assert r.status_code == 200
    assert r.json()["pages"] == 5


def test_merge_endpoint(client, auth, sample_pdf, second_pdf, tmp_path):
    out = str(tmp_path / "merged.pdf")
    r = client.post("/pdf/merge", headers=auth, json={"inputs": [sample_pdf, second_pdf], "output": out})
    assert r.status_code == 200
    assert r.json()["pages"] == 8


def test_delete_pages_endpoint(client, auth, sample_pdf, tmp_path):
    out = str(tmp_path / "del.pdf")
    r = client.post("/pdf/delete-pages", headers=auth, json={"input": sample_pdf, "output": out, "pages": [1]})
    assert r.status_code == 200
    assert r.json()["pages"] == 4


def test_bad_rotation_returns_400(client, auth, sample_pdf, tmp_path):
    out = str(tmp_path / "x.pdf")
    r = client.post("/pdf/rotate", headers=auth, json={"input": sample_pdf, "output": out, "rotation": 45})
    assert r.status_code == 400


def test_missing_file_returns_400(client, auth, tmp_path):
    r = client.post("/pdf/info", headers=auth, json={"path": str(tmp_path / "nope.pdf")})
    assert r.status_code == 400
