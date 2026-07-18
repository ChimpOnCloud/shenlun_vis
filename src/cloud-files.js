import { get, ref, remove, set } from 'firebase/database';
import { rtdb } from './firebase';

const MAX_SYNC_SIZE = 10 * 1024 * 1024;

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
    const data = await blobToBase64(blob);
    await set(ref(rtdb, `files/${sessionId}/${fileKey}`), { name, data, size: blob.size });
    return true;
  } catch {
    return false;
  }
}

export async function downloadSessionFile(sessionId, fileKey) {
  if (!rtdb) return null;
  const snap = await get(ref(rtdb, `files/${sessionId}/${fileKey}`));
  if (!snap.exists()) return null;
  const val = snap.val();
  return { name: val.name, blob: await base64ToBlob(val.data) };
}

export const removeCloudFile = (sessionId, fileKey) =>
  rtdb && remove(ref(rtdb, `files/${sessionId}/${fileKey}`));

export const removeCloudSessionFiles = (sessionId) =>
  rtdb && remove(ref(rtdb, `files/${sessionId}`));
