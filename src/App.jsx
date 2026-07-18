import { useEffect, useRef, useState } from 'react';
import { pdfjs } from 'react-pdf';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { clearFiles, loadFiles, removeFile, saveFile } from './store';
import DropZone from './components/DropZone';
import PdfPane from './components/PdfPane';
import AnnotationPanel from './components/AnnotationPanel';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MAX_FILES = 3;

function getWorkspaceId() {
  let id = localStorage.getItem('shenlun_ws');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('shenlun_ws', id);
  }
  return id;
}

export default function App() {
  const [panes, setPanes] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saveState, setSaveState] = useState(isFirebaseConfigured ? 'saved' : 'local');
  const wsId = useRef(getWorkspaceId()).current;
  const pageRefs = useRef(new Map());

  useEffect(() => {
    loadFiles().then((items) => {
      setPanes(items.map((it) => ({
        key: it.key,
        url: URL.createObjectURL(it.blob),
        name: it.name,
        numPages: 0,
        scale: 1,
      })));
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    setDoc(doc(db, 'workspaces', wsId), { createdAt: serverTimestamp() }, { merge: true });
    const unsub = onSnapshot(collection(db, 'workspaces', wsId, 'annotations'), (snap) => {
      setAnnotations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSaveState('saved');
    });
    return unsub;
  }, [wsId]);

  async function addFiles(fileList) {
    const files = [...fileList]
      .filter((f) => f.type === 'application/pdf')
      .slice(0, MAX_FILES - panes.length);
    if (!files.length) return;
    const newPanes = [];
    for (const file of files) {
      const key = crypto.randomUUID();
      await saveFile(key, file);
      newPanes.push({ key, url: URL.createObjectURL(file), name: file.name, numPages: 0, scale: 1 });
    }
    setPanes((p) => [...p, ...newPanes]);
  }

  async function removePane(key) {
    const pane = panes.find((p) => p.key === key);
    if (pane) URL.revokeObjectURL(pane.url);
    setPanes((p) => p.filter((x) => x.key !== key));
    await removeFile(key);
    const doomed = annotations.filter((a) => a.fileKey === key);
    if (isFirebaseConfigured) {
      for (const a of doomed) {
        await deleteDoc(doc(db, 'workspaces', wsId, 'annotations', a.id));
      }
    }
    setAnnotations((a) => a.filter((x) => x.fileKey !== key));
  }

  function setScale(key, scale) {
    setPanes((p) => p.map((x) => (
      x.key === key ? { ...x, scale: Math.min(3, Math.max(0.5, scale)) } : x
    )));
  }

  function handlePageClick(fileKey, page, x, y) {
    setDraft({ fileKey, page, x, y });
    setSelectedId(null);
  }

  async function commitDraft(text) {
    const data = { ...draft, text };
    setDraft(null);
    if (!isFirebaseConfigured) {
      setAnnotations((a) => [...a, { id: crypto.randomUUID(), ...data }]);
      return;
    }
    setSaveState('saving');
    await addDoc(collection(db, 'workspaces', wsId, 'annotations'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  }

  async function updateAnnotation(id, text) {
    setSelectedId(null);
    if (!isFirebaseConfigured) {
      setAnnotations((a) => a.map((x) => (x.id === id ? { ...x, text } : x)));
      return;
    }
    setSaveState('saving');
    await updateDoc(doc(db, 'workspaces', wsId, 'annotations', id), { text });
  }

  async function deleteAnnotation(id) {
    setSelectedId((s) => (s === id ? null : s));
    if (!isFirebaseConfigured) {
      setAnnotations((a) => a.filter((x) => x.id !== id));
      return;
    }
    setSaveState('saving');
    await deleteDoc(doc(db, 'workspaces', wsId, 'annotations', id));
  }

  function locateAnnotation(a) {
    setSelectedId(a.id);
    setDraft(null);
    pageRefs.current.get(`${a.fileKey}-${a.page}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function clearWorkspace() {
    if (!window.confirm('确定清空所有文件和批注？此操作不可恢复。')) return;
    for (const p of panes) URL.revokeObjectURL(p.url);
    setPanes([]);
    await clearFiles();
    if (isFirebaseConfigured) {
      const snap = await getDocs(collection(db, 'workspaces', wsId, 'annotations'));
      for (const d of snap.docs) await deleteDoc(d.ref);
    }
    setAnnotations([]);
  }

  const registerPageRef = (id) => (el) => {
    if (el) pageRefs.current.set(id, el);
    else pageRefs.current.delete(id);
  };

  return (
    <div className="app">
      <header className="toolbar">
        <h1>申论对比批注</h1>
        <label className={`btn ${panes.length >= MAX_FILES ? 'disabled' : ''}`}>
          添加文件 ({panes.length}/{MAX_FILES})
          <input
            type="file"
            accept="application/pdf"
            multiple
            hidden
            disabled={panes.length >= MAX_FILES}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </label>
        <button
          className={`btn ${annotateMode ? 'active' : ''}`}
          onClick={() => { setAnnotateMode(!annotateMode); setDraft(null); }}
        >
          {annotateMode ? '退出批注模式' : '添加批注'}
        </button>
        <span className={`save-state ${saveState}`}>
          {saveState === 'local' && '本地模式（未配置 Firebase）'}
          {saveState === 'saving' && '保存中…'}
          {saveState === 'saved' && '已同步到 Firebase'}
        </span>
        <button className="btn danger" onClick={clearWorkspace}>清空</button>
      </header>

      <div
        className="main"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        {panes.length === 0 ? (
          <DropZone onFiles={addFiles} />
        ) : (
          <div className="panes" style={{ gridTemplateColumns: `repeat(${panes.length}, 1fr)` }}>
            {panes.map((pane) => (
              <PdfPane
                key={pane.key}
                pane={pane}
                annotations={annotations.filter((a) => a.fileKey === pane.key)}
                annotateMode={annotateMode}
                draft={draft?.fileKey === pane.key ? draft : null}
                selectedId={selectedId}
                onPageClick={handlePageClick}
                onCommitDraft={commitDraft}
                onCancelDraft={() => setDraft(null)}
                onSelect={setSelectedId}
                onUpdate={updateAnnotation}
                onDelete={deleteAnnotation}
                onZoom={(s) => setScale(pane.key, s)}
                onRemove={() => removePane(pane.key)}
                onNumPages={(n) => setPanes((p) => p.map((x) => (
                  x.key === pane.key ? { ...x, numPages: n } : x
                )))}
                registerPageRef={registerPageRef}
              />
            ))}
          </div>
        )}
        {panes.length > 0 && (
          <AnnotationPanel
            panes={panes}
            annotations={annotations}
            onLocate={locateAnnotation}
            onDelete={deleteAnnotation}
          />
        )}
      </div>
    </div>
  );
}
