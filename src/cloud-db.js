import { cloudSyncEnabled, rtdbReq } from './cloud-files';

const objToList = (obj) =>
  obj ? Object.entries(obj).map(([id, v]) => ({ id, ...v })) : [];

export async function listSessions() {
  if (!cloudSyncEnabled) return [];
  const data = await rtdbReq('GET', 'sessions');
  return objToList(data).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function createSession(id, { name, files }) {
  return rtdbReq('PUT', `sessions/${id}`, {
    name,
    createdAt: Date.now(),
    files: files || [],
  });
}

export function updateSessionFiles(id, files) {
  return rtdbReq('PUT', `sessions/${id}/files`, files);
}

export function deleteCloudSession(id) {
  return Promise.all([
    rtdbReq('DELETE', `sessions/${id}`),
    rtdbReq('DELETE', `annotations/${id}`),
  ]);
}

export async function listAnnotations(sessionId) {
  if (!cloudSyncEnabled) return [];
  const data = await rtdbReq('GET', `annotations/${sessionId}`);
  return objToList(data);
}

export function addCloudAnnotation(sessionId, id, data) {
  return rtdbReq('PUT', `annotations/${sessionId}/${id}`, {
    ...data,
    createdAt: Date.now(),
  });
}

export function updateCloudAnnotation(sessionId, id, text) {
  return rtdbReq('PUT', `annotations/${sessionId}/${id}/text`, text);
}

export function deleteCloudAnnotation(sessionId, id) {
  return rtdbReq('DELETE', `annotations/${sessionId}/${id}`);
}
