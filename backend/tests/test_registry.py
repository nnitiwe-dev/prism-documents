from __future__ import annotations

from prism_backend import registry


def test_tool_ids_unique():
    ids = [t["id"] for t in registry.TOOLS]
    assert len(ids) == len(set(ids))


def test_every_tool_has_valid_category():
    category_ids = {c["id"] for c in registry.CATEGORIES}
    for tool in registry.TOOLS:
        assert tool["category"] in category_ids, tool["id"]


def test_backend_ready_tools_have_endpoints():
    for tool in registry.TOOLS:
        if tool["execution"] == "backend" and tool["status"] == "ready":
            assert tool.get("endpoint"), tool["id"]


def test_status_values_are_known():
    for tool in registry.TOOLS:
        assert tool["status"] in {"ready", "beta", "planned"}
