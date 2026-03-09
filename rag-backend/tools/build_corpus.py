#!/usr/bin/env python3
"""Build a JSON corpus from all PDFs in ../publications for RAG retrieval."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader


WHITESPACE_RE = re.compile(r"\s+")


@dataclass
class Chunk:
    id: str
    file_name: str
    title: str
    page: int
    text: str


def normalize_text(text: str) -> str:
    text = WHITESPACE_RE.sub(" ", text or "").strip()
    return text


def title_from_filename(file_name: str) -> str:
    stem = Path(file_name).stem
    title = stem.replace("_", " ").replace("-", " ")
    title = WHITESPACE_RE.sub(" ", title).strip()
    return title


def split_into_chunks(text: str, chunk_size: int, overlap: int) -> Iterable[str]:
    text = normalize_text(text)
    if not text:
        return

    start = 0
    text_length = len(text)

    while start < text_length:
        max_end = min(start + chunk_size, text_length)
        if max_end == text_length:
            end = text_length
        else:
            window = text[start:max_end]
            sentence_break = max(window.rfind(". "), window.rfind("; "), window.rfind(": "))
            if sentence_break >= int(chunk_size * 0.5):
                end = start + sentence_break + 1
            else:
                end = max_end

        chunk = text[start:end].strip()
        if chunk:
            yield chunk

        if end >= text_length:
            break

        start = max(end - overlap, start + 1)


def extract_chunks_from_pdf(
    pdf_path: Path, chunk_size: int, overlap: int, start_id: int
) -> tuple[list[Chunk], int]:
    reader = PdfReader(str(pdf_path))
    chunks: list[Chunk] = []
    next_id = start_id

    for page_index, page in enumerate(reader.pages, start=1):
        page_text = normalize_text(page.extract_text() or "")
        if not page_text:
            continue

        for chunk_text in split_into_chunks(page_text, chunk_size, overlap):
            chunks.append(
                Chunk(
                    id=f"chunk-{next_id}",
                    file_name=pdf_path.name,
                    title=title_from_filename(pdf_path.name),
                    page=page_index,
                    text=chunk_text,
                )
            )
            next_id += 1

    return chunks, next_id


def sha256_for_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            block = handle.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def build_corpus(source_dir: Path, output_file: Path, chunk_size: int, overlap: int) -> dict:
    if not source_dir.exists():
        raise FileNotFoundError(f"Source directory does not exist: {source_dir}")

    discovered_pdfs = sorted(p for p in source_dir.iterdir() if p.suffix.lower() == ".pdf")
    if not discovered_pdfs:
        raise FileNotFoundError(f"No PDF files found in: {source_dir}")

    unique_files: list[Path] = []
    duplicate_files: list[str] = []
    seen_hashes: set[str] = set()

    for pdf_path in discovered_pdfs:
        file_hash = sha256_for_file(pdf_path)
        if file_hash in seen_hashes:
            duplicate_files.append(pdf_path.name)
            continue
        seen_hashes.add(file_hash)
        unique_files.append(pdf_path)

    all_chunks: list[Chunk] = []
    next_id = 1

    for pdf_path in unique_files:
        chunks, next_id = extract_chunks_from_pdf(pdf_path, chunk_size, overlap, next_id)
        all_chunks.extend(chunks)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_dir": str(source_dir),
        "chunk_size": chunk_size,
        "overlap": overlap,
        "file_count": len(unique_files),
        "discovered_pdf_count": len(discovered_pdfs),
        "duplicate_files_skipped": duplicate_files,
        "chunk_count": len(all_chunks),
        "chunks": [chunk.__dict__ for chunk in all_chunks],
    }

    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(json.dumps(payload, indent=2, ensure_ascii=True), encoding="utf-8")
    return payload


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    website_root = script_dir.parent.parent

    parser = argparse.ArgumentParser(description="Build RAG corpus from publication PDFs.")
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=website_root / "publications",
        help="Directory containing publication PDFs.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=script_dir.parent / "data" / "corpus.json",
        help="Output corpus JSON path.",
    )
    parser.add_argument("--chunk-size", type=int, default=1200)
    parser.add_argument("--overlap", type=int, default=180)

    args = parser.parse_args()

    payload = build_corpus(
        source_dir=args.source_dir,
        output_file=args.output,
        chunk_size=args.chunk_size,
        overlap=args.overlap,
    )

    print(
        f"Built corpus with {payload['chunk_count']} chunks from "
        f"{payload['file_count']} PDFs -> {args.output}"
    )


if __name__ == "__main__":
    main()
