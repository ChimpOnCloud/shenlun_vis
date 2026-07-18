import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, deleteDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyDmBM0M48YgRSuyBoa7nr7Sv-5mBMZUUW4',
  authDomain: 'shenlun-vis.firebaseapp.com',
  projectId: 'shenlun-vis',
});
const db = getFirestore(app);
try {
  const ref = await addDoc(collection(db, 'workspaces', 'diag-test', 'annotations'), {
    text: '诊断', page: 1, x: 0.5, y: 0.5,
  });
  console.log('WRITE OK:', ref.id);
  const snap = await getDocs(collection(db, 'workspaces', 'diag-test', 'annotations'));
  console.log('READ OK, docs:', snap.size);
  await deleteDoc(ref);
  console.log('DELETE OK');
} catch (e) {
  console.log('FIRESTORE ERROR:', e.code, e.message);
}
process.exit(0);
