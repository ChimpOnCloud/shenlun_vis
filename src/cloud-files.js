import { get, ref, remove, set } from 'firebase/database';
import { rtdb } from './firebase';

const MAX_SYNC_SIZE = 50 * 1024 * 1024;
const CHUNK_SIZE = 4 * 1024 * 1024;

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

export async function uploadSessionFile(sessionId, fileKey, name, blob) {
  if (!rtdb || blob.size > MAX_SYNC_SIZE) return false;
  try {
    const path = `files/${sessionId}/${fileKey}`;
    const data = await blobToBase64(blob);
    await remove(ref(rtdb, path));
    if (data.length <= CHUNK_SIZE) {
      await set(ref(rtdb, path), { name, data, size: blob.size });
    } else {
      const chunkCount = Math.ceil(data.length / CHUNK_SIZE);
      for (let i = 0; i < chunkCount; i++) {
        await set(ref(rtdb, `${path}/chunks/${i}`), data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
      await set(ref(rtdb, `${path}/meta`), { name, size: blob.size, chunked: true, chunkCount });
    }
    return true;
  } catch (e) {
    console.error('云端文件上传失败:', name, e);
    return false;
  }
}

export async function downloadSessionFile(sessionId, fileKey) {
  if (!rtdb) return null;
  const snap = await get(ref(rtdb, `files/${sessionId}/${fileKey}`));
  if (!snap.exists()) return null;
  const val = snap.val();
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
  if (!rtdb) return true;
  try {
    const snap = await get(ref(rtdb, `files/${sessionId}/${fileKey}`));
    return snap.exists();
  } catch {
    return true;
  }
}

export const removeCloudFile = (sessionId, fileKey) =>
  rtdb && remove(ref(rtdb, `files/${sessionId}/${fileKey}`));

export const removeCloudSessionFiles = (sessionId) =>
  rtdb && remove(ref(rtdb, `files/${sessionId}`));
