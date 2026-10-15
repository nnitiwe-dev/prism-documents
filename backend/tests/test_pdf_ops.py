from __future__ import annotations

import pytest
from pypdf import PdfReader

from prism_backend.services import extraction, pdf_ops
from prism_backend.services._common import PdfOpError


def _pages(path: str) -> int:
    return len(PdfReader(path).pages)


def test_info(sample_pdf):
    info = pdf_ops.get_info(sample_pdf)
    assert info["pages"] == 5
    assert info["encrypted"] is False
    assert info["size_bytes"] > 0


def test_merge(sample_pdf, second_pdf, tmp_path):
    out = str(tmp_path / "merged.pdf")
    result = pdf_ops.merge([sample_pdf, second_pdf], out)
    assert result["pages"] == 8
    assert _pages(out) == 8


def test_rotate_all(sample_pdf, tmp_path):
    out = str(tmp_path / "rot.pdf")
    pdf_ops.rotate(sample_pdf, out, 90)
    assert PdfReader(out).pages[0].rotation == 90


def test_rotate_invalid_angle(sample_pdf, tmp_path):
    with pytest.raises(PdfOpError):
        pdf_ops.rotate(sample_pdf, str(tmp_path / "x.pdf"), 45)


def test_rotate_specific_pages(sample_pdf, tmp_path):
    out = str(tmp_path / "rot2.pdf")
    pdf_ops.rotate(sample_pdf, out, 180, pages=[1])
    reader = PdfReader(out)
    assert reader.pages[0].rotation == 180
    assert reader.pages[1].rotation == 0


def test_delete_pages(sample_pdf, tmp_path):
    out = str(tmp_path / "del.pdf")
    result = pdf_ops.delete_pages(sample_pdf, out, [2, 4])
    assert result["pages"] == 3


def test_delete_all_pages_rejected(sample_pdf, tmp_path):
    with pytest.raises(PdfOpError):
        pdf_ops.delete_pages(sample_pdf, str(tmp_path / "x.pdf"), [1, 2, 3, 4, 5])


def test_reorder(sample_pdf, tmp_path):
    out = str(tmp_path / "ord.pdf")
    result = pdf_ops.reorder(sample_pdf, out, [5, 4, 3, 2, 1])
    assert result["pages"] == 5


def test_reorder_not_permutation(sample_pdf, tmp_path):
    with pytest.raises(PdfOpError):
        pdf_ops.reorder(sample_pdf, str(tmp_path / "x.pdf"), [1, 2, 3])


def test_split_ranges(sample_pdf, tmp_path):
    out_dir = str(tmp_path / "out")
    result = pdf_ops.split(sample_pdf, out_dir, ranges=[{"start": 1, "end": 2}, {"start": 3, "end": 5}])
    assert len(result["outputs"]) == 2
    assert _pages(result["outputs"][0]) == 2
    assert _pages(result["outputs"][1]) == 3


def test_split_each_page(sample_pdf, tmp_path):
    result = pdf_ops.split(sample_pdf, str(tmp_path / "each"))
    assert len(result["outputs"]) == 5
    assert all(_pages(o) == 1 for o in result["outputs"])


def test_split_range_out_of_bounds(sample_pdf, tmp_path):
    with pytest.raises(PdfOpError):
        pdf_ops.split(sample_pdf, str(tmp_path / "x"), ranges=[{"start": 1, "end": 99}])


def test_require_pdf_missing(tmp_path):
    with pytest.raises(PdfOpError):
        pdf_ops.get_info(str(tmp_path / "nope.pdf"))


def test_require_pdf_wrong_ext(tmp_path):
    txt = tmp_path / "a.txt"
    txt.write_text("hi")
    with pytest.raises(PdfOpError):
        pdf_ops.get_info(str(txt))


def test_extract_text_returns_all_pages(sample_pdf):
    result = extraction.extract_text(sample_pdf)
    assert [p["page"] for p in result["pages"]] == [1, 2, 3, 4, 5]
