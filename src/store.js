import localforage from 'localforage';

const store = localforage.createInstance({ name: 'shenlun-vis', storeName: 'files' });

const draftKey = (fileKey) => `draft-${fileKey}`;
const sessionKey = (sessionId, fileKey) => `session-${sessionId}-${fileKey}`;

export const saveDraftFile = (fileKey, file) =>
  store.setItem(draftKey(fileKey), { name: file.name, blob: file });

export const loadDraftFile = (fileKey) => store.getItem(draftKey(fileKey));

export async function loadDraftFiles() {
  const items = [];
  await store.iterate((val, key) => {
    if (key.startsWith('draft-')) items.push({ key: key.slice(6), ...val });
  });
  return items;
}

export const removeDraftFile = (fileKey) => store.removeItem(draftKey(fileKey));

export async function clearDraftFiles() {
  const keys = (await store.keys()).filter((k) => k.startsWith('draft-'));
  for (const k of keys) await store.removeItem(k);
}

export const saveSessionFile = (sessionId, fileKey, name, blob) =>
  store.setItem(sessionKey(sessionId, fileKey), { name, blob });

export const loadSessionFile = (sessionId, fileKey) =>
  store.getItem(sessionKey(sessionId, fileKey));

export const removeSessionFile = (sessionId, fileKey) =>
  store.removeItem(sessionKey(sessionId, fileKey));

export async function removeSessionFiles(sessionId) {
  const prefix = `session-${sessionId}-`;
  const keys = (await store.keys()).filter((k) => k.startsWith(prefix));
  for (const k of keys) await store.removeItem(k);
}
