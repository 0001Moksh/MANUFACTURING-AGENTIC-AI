"""Local, category-aware RAG for machine documents.

Vectors use deterministic feature hashing so no document leaves the installation.
The persisted JSON index is auditable and the relational chunk rows support fast
machine-scoped retrieval without an external vector database service.
"""
import hashlib
import json
import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import MachineDocument, MachineDocumentChunk

VECTOR_DIMENSIONS = 384
CHUNK_SIZE = 900
CHUNK_OVERLAP = 160
INDEX_DIRECTORY = Path(__file__).resolve().parent.parent / "machine_document_embeddings"


def _tokens(value: str) -> List[str]:
    return re.findall(r"[a-z0-9][a-z0-9_-]{1,}", value.lower())


def _embedding(value: str) -> Dict[str, float]:
    """Sparse normalized local feature-hash embedding; contains no raw file data."""
    weights: Dict[int, float] = {}
    for token in _tokens(value):
        bucket = int(hashlib.sha256(token.encode()).hexdigest()[:8], 16) % VECTOR_DIMENSIONS
        weights[bucket] = weights.get(bucket, 0.0) + 1.0
    magnitude = sum(weight * weight for weight in weights.values()) ** 0.5 or 1.0
    return {str(bucket): round(weight / magnitude, 7) for bucket, weight in weights.items()}


def _extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix in {".docx", ".xlsx", ".xls"}:
        try:
            with zipfile.ZipFile(path) as archive:
                xml = "\n".join(archive.read(name).decode("utf-8", errors="ignore") for name in archive.namelist() if name.endswith(".xml"))
            return re.sub(r"<[^>]+>", " ", xml).replace("&amp;", "&")
        except zipfile.BadZipFile:
            pass
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader
            return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
        except (ImportError, Exception):
            return ""
    if suffix == ".doc":
        # Legacy binary Word needs a local converter; never upload it externally.
        return ""
    # Do not fabricate text or silently send files to a cloud service.
    return ""


def _chunks(text: str) -> List[str]:
    cleaned = re.sub(r"\s+", " ", text).strip()
    return [cleaned[index:index + CHUNK_SIZE] for index in range(0, len(cleaned), CHUNK_SIZE - CHUNK_OVERLAP) if cleaned[index:index + CHUNK_SIZE].strip()]


async def index_machine_document(session: AsyncSession, document: MachineDocument) -> int:
    """Create a local persisted embedding index and DB chunk rows for one document."""
    await session.execute(delete(MachineDocumentChunk).where(MachineDocumentChunk.document_id == document.id))
    text = _extract_text(Path(document.stored_path))
    chunks = _chunks(text)
    records = []
    for index, content in enumerate(chunks):
        vector = _embedding(content)
        session.add(MachineDocumentChunk(document_id=document.id, machine_code=document.machine_code, document_type=document.document_type, chunk_index=index, content=content, embedding=vector))
        records.append({"chunk_index": index, "embedding": vector})
    INDEX_DIRECTORY.mkdir(parents=True, exist_ok=True)
    index_path = INDEX_DIRECTORY / f"machine_document_{document.id}.json"
    index_path.write_text(json.dumps({"document_id": document.id, "machine_code": document.machine_code, "category": document.document_type, "dimensions": VECTOR_DIMENSIONS, "chunks": records}), encoding="utf-8")
    document.embedding_path = str(index_path)
    document.indexed_at = datetime.utcnow()
    return len(chunks)


def _dot(left: Dict[str, float], right: Dict[str, float]) -> float:
    return sum(value * right.get(key, 0.0) for key, value in left.items())


def _category_score(document_type: str, query: str) -> float:
    lowered = query.lower()
    keywords = {
        "Repair Guide": ("repair", "fault", "failure", "broken"),
        "Troubleshooting Guide": ("warning", "alarm", "error", "anomaly", "fault"),
        "Maintenance Guide": ("maintenance", "lubrication", "inspection", "service"),
        "Service Manual": ("service", "replace", "calibrate"),
        "Safety Document": ("safety", "critical", "hazard", "voltage", "current"),
        "Technical Document": ("threshold", "parameter", "voltage", "current", "temperature"),
    }
    return 0.12 if any(word in lowered for word in keywords.get(document_type, ())) else 0.0


async def retrieve_machine_evidence(session: AsyncSession, machine_code: str, issue_title: str, affected_parameters: List[str], limit: int = 3) -> List[Dict[str, Any]]:
    query = " ".join([issue_title, *affected_parameters])
    query_vector = _embedding(query)
    rows = (await session.execute(select(MachineDocumentChunk, MachineDocument).join(MachineDocument, MachineDocument.id == MachineDocumentChunk.document_id).where(MachineDocumentChunk.machine_code == machine_code))).all()
    ranked = []
    for chunk, document in rows:
        score = _dot(query_vector, chunk.embedding) + _category_score(chunk.document_type, query)
        if score > 0:
            ranked.append((score, chunk, document))
    ranked.sort(key=lambda item: item[0], reverse=True)
    return [{"document_id": document.id, "title": document.title, "filename": document.original_filename, "category": chunk.document_type, "chunk_index": chunk.chunk_index, "content": chunk.content, "score": round(score, 3)} for score, chunk, document in ranked[:limit]]
