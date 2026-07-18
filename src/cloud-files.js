const MAX_SYNC_SIZE = 50 * 1024 * 1024;
const CHUNK_SIZE = 4 * 1024 * 1024;
const REQ_TIMEOUT = 90 * 1000;

const BASE_URL = (import.meta.env.VITE_FIREBASE_DATABASE_URL || '').replace(/\/$/, '');
export const cloudSyncEnabled = Boolean(BASE_URL);

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function base64ToBlob(base64) {
  const res = await fetch(`data:application/pdf;base64,${base64}`);
  return res.blob();
}

export async function rtdbReq(method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}/${path}.json`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`RTDB ${method} ${path} -> ${res.status}`);
    return res.status === 204 ? null : res.json();
  } finally {
    clearTimeout(timer);
  }
}

const putJson = (path, body) => rtdbReq('PUT', path, body);
const getJson = (path) => rtdbReq('GET', path);
const deletePath = (path) => rtdbReq('DELETE', path);

export async function uploadSessionFile(sessionId, fileKey, name, blob) {
  if (!cloudSyncEnabled || blob.size > MAX_SYNC_SIZE) return false;
  try {
    const path = `files/${sessionId}/${fileKey}`;
    const data = await blobToBase64(blob);
    if (data.length <= CHUNK_SIZE) {
      await putJson(path, { name, data, size: blob.size });
    } else {
      const chunkCount = Math.ceil(data.length / CHUNK_SIZE);
      for (let i = 0; i < chunkCount; i++) {
        await putJson(`${path}/chunks/${i}`, data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
      await putJson(`${path}/meta`, { name, size: blob.size, chunked: true, chunkCount });
    }
    return true;
  } catch (e) {
    console.error('云端文件上传失败:', name, e);
    return false;
  }
}

export async function downloadSessionFile(sessionId, fileKey) {
  if (!cloudSyncEnabled) return null;
  const val = await getJson(`files/${sessionId}/${fileKey}`);
  if (!val) return null;
  if (typeof val.data === 'string') {
    return { name: val.name, blob: await base64ToBlob(val.data) };
  }
  if (val.meta?.chunked && val.chunks) {
    const parts = [];
    for (let i = 0; i < val.meta.chunkCount; i++) {
      const piece = val.chunks[i];
      if (typeof piece !== 'string') return null;
      parts.push(piece);
    }
    return { name: val.meta.name, blob: await base64ToBlob(parts.join('')) };
  }
  return null;
}

export async function cloudFileExists(sessionId, fileKey) {
  if (!cloudSyncEnabled) return true;
  try {
    return (await getJson(`files/${sessionId}/${fileKey}`)) !== null;
  } catch {
    return true;
  }
}

export const removeCloudFile = (sessionId, fileKey) =>
  cloudSyncEnabled && deletePath(`files/${sessionId}/${fileKey}`);

export const removeCloudSessionFiles = (sessionId) =>
  cloudSyncEnabled && deletePath(`files/${sessionId}`);
