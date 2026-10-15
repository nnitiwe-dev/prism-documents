"""Request/response models for the HTTP API.

Page numbers in the API are always 1-indexed and human-facing; they are
converted to 0-indexed internally by the services layer.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MergeIn(BaseModel):
    inputs: list[str] = Field(min_length=1, description="Ordered list of input PDF paths")
    output: str


class RotateIn(BaseModel):
    input: str
    output: str
    rotation: int = Field(description="Degrees clockwise; must be a multiple of 90")
    pages: list[int] | None = Field(default=None, description="1-indexed pages; None = all")


class DeletePagesIn(BaseModel):
    input: str
    output: str
    pages: list[int] = Field(min_length=1, description="1-indexed pages to remove")


class ReorderIn(BaseModel):
    input: str
    output: str
    order: list[int] = Field(min_length=1, description="1-indexed permutation of all pages")


class SplitRange(BaseModel):
    start: int = Field(ge=1, description="1-indexed first page, inclusive")
    end: int = Field(ge=1, description="1-indexed last page, inclusive")
    name: str | None = None


class SplitIn(BaseModel):
    input: str
    output_dir: str
    ranges: list[SplitRange] | None = Field(
        default=None, description="None => split into one file per page"
    )


class ExtractTextIn(BaseModel):
    input: str
    pages: list[int] | None = Field(default=None, description="1-indexed pages; None = all")


class PathIn(BaseModel):
    path: str


class PdfInfo(BaseModel):
    path: str
    pages: int
    encrypted: bool
    title: str | None = None
    author: str | None = None


class OpResult(BaseModel):
    output: str
    pages: int


class SplitResult(BaseModel):
    outputs: list[str]


class PageText(BaseModel):
    page: int
    text: str


class ExtractResult(BaseModel):
    pages: list[PageText]
