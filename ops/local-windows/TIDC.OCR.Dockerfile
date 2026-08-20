FROM python:3.11-slim

WORKDIR /worker
RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-ara poppler-utils \
  && rm -rf /var/lib/apt/lists/*

COPY ops/ocr/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY ops/ocr/ocr-worker.py ./ocr-worker.py

CMD ["python", "ocr-worker.py"]
