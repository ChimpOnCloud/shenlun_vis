import localforage from 'localforage';

const store = localforage.createInstance({ name: 'shenlun-vis', storeName: 'files' });

export const saveFile = (key, file) => store.setItem(key, { name: file.name, blob: file });

export async function loadFiles() {
  const items = [];
  await store.iterate((val, key) => {
    items.push({ key, ...val });
  });
  return items;
}

export const removeFile = (key) => store.removeItem(key);
export const clearFiles = () => store.clear();
