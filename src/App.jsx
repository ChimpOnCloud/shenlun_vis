import { useEffect, useRef, useState } from 'react';
import { pdfjs } from 'react-pdf';
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, rtdb } from './firebase';
import {
  cloudFileExists, downloadSessionFile, removeCloudFile, removeCloudSessionFiles, uploadSessionFile,
} from './cloud-files';
import {
  clearDraftFiles, loadDraftFile, loadDraftFiles, removeDraftFile,
  loadSessionFile, removeSessionFile, removeSessionFiles,
  saveDraftFile, saveSessionFile,
} from './store';
import DropZone from './components/DropZone';
import PdfPane from './components/PdfPane';
import AnnotationPanel from './components/AnnotationPanel';
import SessionSidebar from './components/SessionSidebar';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MAX_FILES = 3;
const DRAFT_ANN_KEY = 'shenlun_draft_annotations';

function readDraftAnnotations() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_ANN_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [panes, setPanes] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [draft, setDraft] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [saveState, setSaveState] = useState('saved');
  const [busy, setBusy] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showPanel, setShowPanel] = useState(true);
  const pageRefs = useRef(new Map());
  const draftLoaded = useRef(false);
  const isDraft = currentId === null;
  const currentSession = sessions.find((s) => s.id === currentId);

  useEffect(() => {
    (async () => {
      const files = await loadDraftFiles();
      const anns = readDraftAnnotations();
      draftLoaded.current = true;
      setPanes(files.map((f) => ({
        key: f.key, name: f.name, url: URL.createObjectURL(f.blob), numPages: 0, scale: 1,
      })));
      setAnnotations(anns);
    })();
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    if (!currentId || !isFirebaseConfigured) return undefined;
    return onSnapshot(collection(db, 'sessions', currentId, 'annotations'), (snap) => {
      setAnnotations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSaveState('saved');
    });
  }, [currentId]);

  useEffect(() => {
    if (isDraft && draftLoaded.current) {
      localStorage.setItem(DRAFT_ANN_KEY, JSON.stringify(annotations));
    }
  }, [annotations, isDraft]);

  function revokePanes(list = panes) {
    for (const p of list) if (p.url) URL.revokeObjectURL(p.url);
  }

  async function openSession(s) {
    if (s.id === currentId) return;
    setBusy(true);
    const newPanes = await Promise.all((s.files || []).map(async (f) => {
      let rec = await loadSessionFile(s.id, f.key);
      if (rec && rtdb) {
        cloudFileExists(s.id, f.key).then((exists) => {
          if (!exists) uploadSessionFile(s.id, f.key, f.name, rec.blob);
        });
      } else if (!rec && rtdb) {
        try {
          const cloud = await downloadSessionFile(s.id, f.key);
          if (cloud) {
            await saveSessionFile(s.id, f.key, cloud.name, cloud.blob);
            rec = cloud;
          }
        } catch {
          // 网络失败时按缺失处理，用户可手动拖入
        }
      }
      return {
        key: f.key,
        name: f.name,
        numPages: 0,
        scale: 1,
        url: rec ? URL.createObjectURL(rec.blob) : null,
        missing: !rec,
      };
    }));
    revokePanes();
    setPanes(newPanes);
    setAnnotations([]);
    setDraft(null);
    setSelectedId(null);
    setCurrentId(s.id);
    setBusy(false);
  }

  async function backToDraft() {
    if (isDraft) return;
    const files = await loadDraftFiles();
    revokePanes();
    setPanes(files.map((f) => ({
      key: f.key, name: f.name, url: URL.createObjectURL(f.blob), numPages: 0, scale: 1,
    })));
    setAnnotations(readDraftAnnotations());
    setDraft(null);
    setSelectedId(null);
    setCurrentId(null);
  }

  async function addFiles(fileList) {
    const files = [...fileList]
      .filter((f) => f.type === 'application/pdf')
      .slice(0, MAX_FILES - panes.length);
    if (!files.length) return;
    const newPanes = [];
    for (const file of files) {
      const key = crypto.randomUUID();
      if (isDraft) {
        await saveDraftFile(key, file);
      } else {
        await saveSessionFile(currentId, key, file.name, file);
        const synced = await uploadSessionFile(currentId, key, file.name, file);
        if (!synced && rtdb) window.alert(`「${file.name}」未能同步到云端（超过 50MB 或网络问题），其他设备需手动拖入`);
      }
      newPanes.push({ key, name: file.name, url: URL.createObjectURL(file), numPages: 0, scale: 1 });
    }
    const all = [...panes, ...newPanes];
    setPanes(all);
    if (!isDraft) {
      await updateDoc(doc(db, 'sessions', currentId), {
        files: all.map(({ key, name }) => ({ key, name })),
      });
    }
  }

  async function saveToCloud() {
    if (!isFirebaseConfigured) return;
    if (!panes.length) {
      window.alert('请先拖入 PDF 文件');
      return;
    }
    const name = window.prompt('给这次对比起个名字：', `对比 ${new Date().toLocaleString('zh-CN')}`);
    if (name === null) return;
    setSaveState('saving');
    const sessionRef = doc(collection(db, 'sessions'));
    const failed = [];
    let done = 0;
    setSaveProgress({ done, total: panes.length });
    for (const p of panes) {
      const rec = await loadDraftFile(p.key);
      if (rec) {
        await saveSessionFile(sessionRef.id, p.key, p.name, rec.blob);
        const synced = await uploadSessionFile(sessionRef.id, p.key, p.name, rec.blob);
        if (!synced) failed.push(p.name);
      } else {
        failed.push(p.name);
      }
      done += 1;
      setSaveProgress({ done, total: panes.length });
    }
    await setDoc(sessionRef, {
      name: name.trim() || '未命名对比',
      createdAt: serverTimestamp(),
      files: panes.map(({ key, name: n }) => ({ key, name: n })),
    });
    if (annotations.length) {
      const batch = writeBatch(db);
      for (const a of annotations) {
        const { id, ...data } = a;
        batch.set(doc(collection(db, 'sessions', sessionRef.id, 'annotations')), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
    setSaveProgress(null);
    await clearDraftFiles();
    localStorage.removeItem(DRAFT_ANN_KEY);
    setCurrentId(sessionRef.id);
    if (failed.length) {
      window.alert(`以下文件未能同步到云端，下次在本机打开该会话时会自动重试：\n${failed.join('\n')}`);
    }
  }

  async function deleteSession(s) {
    if (!window.confirm(`删除「${s.name}」及其所有批注？此操作不可恢复。`)) return;
    const annSnap = await getDocs(collection(db, 'sessions', s.id, 'annotations'));
    for (const d of annSnap.docs) await deleteDoc(d.ref);
    await deleteDoc(doc(db, 'sessions', s.id));
    await removeSessionFiles(s.id);
    await removeCloudSessionFiles(s.id);
    if (currentId === s.id) await backToDraft();
  }

  async function removePane(key) {
    const pane = panes.find((p) => p.key === key);
    if (pane?.url) URL.revokeObjectURL(pane.url);
    const rest = panes.filter((x) => x.key !== key);
    setPanes(rest);
    if (isDraft) {
      await removeDraftFile(key);
      setAnnotations((a) => a.filter((x) => x.fileKey !== key));
    } else {
      await removeSessionFile(currentId, key);
      await removeCloudFile(currentId, key);
      await updateDoc(doc(db, 'sessions', currentId), {
        files: rest.map(({ key: k, name }) => ({ key: k, name })),
      });
      const doomed = annotations.filter((a) => a.fileKey === key);
      for (const a of doomed) {
        await deleteDoc(doc(db, 'sessions', currentId, 'annotations', a.id));
      }
    }
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
    if (isDraft) {
      setAnnotations((a) => [...a, { id: crypto.randomUUID(), ...data }]);
      return;
    }
    setSaveState('saving');
    await addDoc(collection(db, 'sessions', currentId, 'annotations'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  }

  async function updateAnnotation(id, text) {
    setSelectedId(null);
    if (isDraft) {
      setAnnotations((a) => a.map((x) => (x.id === id ? { ...x, text } : x)));
      return;
    }
    setSaveState('saving');
    await updateDoc(doc(db, 'sessions', currentId, 'annotations', id), { text });
  }

  async function deleteAnnotation(id) {
    setSelectedId((s) => (s === id ? null : s));
    if (isDraft) {
      setAnnotations((a) => a.filter((x) => x.id !== id));
      return;
    }
    setSaveState('saving');
    await deleteDoc(doc(db, 'sessions', currentId, 'annotations', id));
  }

  function locateAnnotation(a) {
    setSelectedId(a.id);
    setDraft(null);
    pageRefs.current.get(`${a.fileKey}-${a.page}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function clearDraft() {
    if (!window.confirm('清空当前草稿的所有文件和批注？')) return;
    revokePanes();
    setPanes([]);
    setAnnotations([]);
    await clearDraftFiles();
    localStorage.removeItem(DRAFT_ANN_KEY);
  }

  async function handleMissingFile(fileKey, file) {
    if (file.type !== 'application/pdf' || isDraft) return;
    await saveSessionFile(currentId, fileKey, file.name, file);
    await uploadSessionFile(currentId, fileKey, file.name, file);
    setPanes((p) => p.map((x) => (
      x.key === fileKey ? { ...x, url: URL.createObjectURL(file), missing: false } : x
    )));
  }

  const registerPageRef = (id) => (el) => {
    if (el) pageRefs.current.set(id, el);
    else pageRefs.current.delete(id);
  };

  return (
    <div className="app">
      <header className="toolbar">
        <h1>申论对比批注</h1>
        <span className={`mode-badge ${isDraft ? 'draft' : 'saved'}`}>
          {isDraft ? '草稿（未保存）' : `当前：${currentSession?.name || '…'}`}
        </span>
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
        {isDraft && isFirebaseConfigured && (
          <button className="btn primary" onClick={saveToCloud}>保存到云端</button>
        )}
        <button
          className={`btn ${annotateMode ? 'active' : ''}`}
          onClick={() => { setAnnotateMode(!annotateMode); setDraft(null); }}
        >
          {annotateMode ? '退出批注模式' : '添加批注'}
        </button>
        <button
          className={`btn ${showSidebar ? 'active' : ''}`}
          title="显示/隐藏左侧会话栏"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          会话栏
        </button>
        <button
          className={`btn ${showPanel ? 'active' : ''}`}
          title="显示/隐藏右侧批注列表"
          onClick={() => setShowPanel(!showPanel)}
        >
          批注列表
        </button>
        <span className={`save-state ${saveState}`}>
          {saveProgress && `正在上传文件 ${saveProgress.done}/${saveProgress.total}…（请勿关闭页面）`}
          {!saveProgress && busy && '正在从云端下载文件…'}
          {!saveProgress && !busy && isDraft && '草稿仅保存在本机'}
          {!saveProgress && !busy && !isDraft && saveState === 'saving' && '保存中…'}
          {!saveProgress && !busy && !isDraft && saveState === 'saved' && '已同步到 Firebase'}
        </span>
        {isDraft && <button className="btn danger" onClick={clearDraft}>清空</button>}
      </header>

      <div
        className="main"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        {showSidebar && (
          <SessionSidebar
            sessions={sessions}
            currentId={currentId}
            onOpen={openSession}
            onDelete={deleteSession}
            onNew={backToDraft}
          />
        )}
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
                onMissingFile={(f) => handleMissingFile(pane.key, f)}
                onNumPages={(n) => setPanes((p) => p.map((x) => (
                  x.key === pane.key ? { ...x, numPages: n } : x
                )))}
                registerPageRef={registerPageRef}
              />
            ))}
          </div>
        )}
        {panes.length > 0 && showPanel && (
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
