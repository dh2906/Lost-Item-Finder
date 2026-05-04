FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN pip install \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.5.1 && \
  pip install \
    fastapi==0.124.4 \
    requests==2.32.5 \
    uvicorn[standard]==0.38.0 \
    sentence-transformers==5.2.0

COPY app.py .

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]
