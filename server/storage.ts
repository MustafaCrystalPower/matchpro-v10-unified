/**
 * MatchPro Unified — Local Storage Module
 * Replaces Manus storage proxy with local filesystem + optional S3.
 * INDEPENDENT — no external platform dependency.
 */

import { ENV } from './_core/env';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve(ENV.uploadDir || './uploads');

// Ensure upload directory exists
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Store a file locally.
 * Returns a local URL path that can be served via Express static middleware.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  ensureUploadDir();

  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOAD_DIR, key);

  // Ensure subdirectory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  if (typeof data === 'string') {
    fs.writeFileSync(filePath, data, 'utf-8');
  } else {
    fs.writeFileSync(filePath, data);
  }

  const url = `/uploads/${key}`;
  console.log(`[Storage] Saved: ${key} (${contentType})`);

  return { key, url };
}

/**
 * Get a public URL for a stored file.
 */
export async function storageGetUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  return `/uploads/${key}`;
}

/**
 * Check if a file exists in storage.
 */
export async function storageExists(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOAD_DIR, key);
  return fs.existsSync(filePath);
}

/**
 * Delete a file from storage.
 */
export async function storageDelete(relKey: string): Promise<boolean> {
  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOAD_DIR, key);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Generate a unique filename for uploads.
 */
export function generateStorageKey(originalName: string, prefix = 'images'): string {
  const ext = path.extname(originalName);
  const hash = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return `${prefix}/${timestamp}-${hash}${ext}`;
}
