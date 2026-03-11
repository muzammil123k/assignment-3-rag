from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import logging

# Initialize FastAPI
app = FastAPI(title="Embedding Service")

# Load the model (all-mpnet-base-v2 outputs exactly 768 dimensions!)
# This runs once when the container starts
print("Loading sentence transformer model...")
model = SentenceTransformer('all-mpnet-base-v2')
print("Model loaded successfully.")

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    embedding: list[float]

@app.get("/healthz")
def health_check():
    return {"status": "ok"}

@app.post("/embed", response_model=EmbedResponse)
def generate_embedding(request: EmbedRequest):
    try:
        # Generate the embedding
        vector = model.encode(request.text).tolist()
        return {"embedding": vector}
    except Exception as e:
        logging.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail="Internal server error generating embedding")