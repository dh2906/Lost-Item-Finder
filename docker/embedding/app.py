import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer


MODEL_NAME = os.getenv("EMBEDDING_MODEL", "intfloat/multilingual-e5-base")
EXPECTED_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))

app = FastAPI(title="Findy local embedding server")
model: SentenceTransformer | None = None


class EmbedRequest(BaseModel):
    input: str | list[str]


@app.on_event("startup")
def load_model() -> None:
    global model
    model = SentenceTransformer(MODEL_NAME)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok" if model is not None else "loading",
        "model": MODEL_NAME,
        "dimensions": EXPECTED_DIMENSIONS,
    }


@app.post("/embed")
def embed(request: EmbedRequest) -> dict[str, Any]:
    if model is None:
        raise RuntimeError("Embedding model is not loaded")

    inputs = request.input if isinstance(request.input, list) else [request.input]
    embeddings = model.encode(
        inputs,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    data = embeddings.tolist()

    if data and len(data[0]) != EXPECTED_DIMENSIONS:
        raise RuntimeError(
            f"Embedding dimension mismatch: expected {EXPECTED_DIMENSIONS}, got {len(data[0])}"
        )

    return {
        "model": MODEL_NAME,
        "dimensions": EXPECTED_DIMENSIONS,
        "data": data if isinstance(request.input, list) else data[0],
    }
