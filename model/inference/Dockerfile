FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY model/inference/pyproject.toml /app/model/inference/pyproject.toml
RUN pip install --no-cache-dir /app/model/inference

COPY model /app/model

EXPOSE 8000

CMD ["uvicorn", "model.inference.app:app", "--host", "0.0.0.0", "--port", "8000"]
