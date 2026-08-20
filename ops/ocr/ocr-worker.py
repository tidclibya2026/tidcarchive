#!/usr/bin/env python3
"""TIDC local OCR worker. Run only inside the local server network."""
import io
import os
from concurrent.futures import ThreadPoolExecutor

import boto3
import pytesseract
import requests
from flask import Flask, jsonify, request
from pdf2image import convert_from_bytes
from PIL import Image

app = Flask(__name__)
executor = ThreadPoolExecutor(max_workers=int(os.environ.get("OCR_WORKERS", "2")))

def env(name):
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

def check_secret(value):
    return value and value == env("LOCAL_OCR_SHARED_SECRET")

def object_store():
    return boto3.client(
        "s3",
        endpoint_url=env("MINIO_ENDPOINT"),
        aws_access_key_id=env("MINIO_ACCESS_KEY"),
        aws_secret_access_key=env("MINIO_SECRET_KEY"),
        region_name=os.environ.get("MINIO_REGION", "local"),
    )

def callback(attachment_id, status, extracted_text=None, error=None):
    payload = {"attachmentId": attachment_id, "status": status}
    if extracted_text is not None:
        payload["extractedText"] = extracted_text
    if error:
        payload["error"] = error[:500]
    response = requests.post(
        f"{env('TIDC_APP_BASE_URL').rstrip('/')}/api/internal/ocr/result",
        json=payload,
        headers={"X-TIDC-OCR-Secret": env("LOCAL_OCR_SHARED_SECRET")},
        timeout=30,
    )
    response.raise_for_status()

def extract_text(file_bytes, mime_type):
    language = os.environ.get("OCR_LANGUAGE", "ara+eng")
    if mime_type == "application/pdf":
        max_pages = int(os.environ.get("OCR_MAX_PDF_PAGES", "50"))
        pages = convert_from_bytes(file_bytes, dpi=300, first_page=1, last_page=max_pages)
        return "\n\n".join(pytesseract.image_to_string(page, lang=language) for page in pages).strip()
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    return pytesseract.image_to_string(image, lang=language).strip()

def process_job(attachment_id, file_key, mime_type):
    try:
        data = object_store().get_object(Bucket=env("MINIO_BUCKET"), Key=file_key)["Body"].read()
        text = extract_text(data, mime_type)
        if not text:
            raise RuntimeError("لم يُستخرج نص قابل للفهرسة من المرفق.")
        callback(attachment_id, "completed", extracted_text=text)
    except Exception as exc:  # Never return document bytes or stack traces to the app.
        callback(attachment_id, "failed", error=str(exc))

@app.post("/v1/ocr/jobs")
def create_job():
    if not check_secret(request.headers.get("X-TIDC-OCR-Secret")):
        return jsonify(error="forbidden"), 403
    body = request.get_json(silent=True) or {}
    attachment_id = body.get("attachmentId")
    file_key = body.get("fileKey")
    mime_type = body.get("mimeType")
    if not isinstance(attachment_id, int) or not isinstance(file_key, str) or mime_type not in {"application/pdf", "image/jpeg", "image/png", "image/webp"}:
        return jsonify(error="invalid-job"), 400
    executor.submit(process_job, attachment_id, file_key, mime_type)
    return jsonify(accepted=True, attachmentId=attachment_id), 202

if __name__ == "__main__":
    app.run(host=os.environ.get("OCR_HOST", "127.0.0.1"), port=int(os.environ.get("OCR_PORT", "4310")))
