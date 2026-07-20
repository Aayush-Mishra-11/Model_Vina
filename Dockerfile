# ---- Builder stage: install heavy deps in a fresh layer ----
FROM python:3.12-slim AS builder

WORKDIR /app

# Install Python deps in their own layer so source changes don't bust the cache.
# faster-whisper uses PyAV (bundled `av` package) for audio decoding, so we
# don't need a system ffmpeg install. The runtime image stays small (~1 GB).
COPY server/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- Runtime stage: slim image, copy in built deps ----
FROM python:3.12-slim AS runtime

RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy installed Python packages and any CLI entrypoints from the builder.
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy the application source.
COPY server /app/server
# Hugging Face Spaces expects port 7860 by default. Render / Fly / generic
# Docker hosts usually expect 8080 or PORT. We listen on 0.0.0.0:$PORT
# so the platform can decide. Default to 4000 for local dev.
ENV PORT=4000 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER appuser

EXPOSE 4000

# Single-worker uvicorn: faster-whisper loads the model into the process
# memory and spawning multiple workers would duplicate that ~400MB load.
# For higher throughput, run multiple containers behind a load balancer.
CMD ["sh", "-c", "uvicorn server.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
