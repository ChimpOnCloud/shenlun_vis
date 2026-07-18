import { useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';

export default function PdfPane({
  pane, annotations, annotateMode, draft, selectedId,
  onPageClick, onCommitDraft, onCancelDraft, onSelect, onUpdate, onDelete,
  onZoom, onRemove, onMissingFile, onNumPages, registerPageRef,
}) {
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      onZoom(pane.scale + (e.deltaY < 0 ? 0.25 : -0.25));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [pane.scale, onZoom]);

  const sorted = [...annotations].sort((a, b) => (
    a.page - b.page || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
  ));
  const numberOf = (id) => sorted.findIndex((a) => a.id === id) + 1;

  function handleClick(e, page) {
    if (!annotateMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onPageClick(
      pane.key,
      page,
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
    );
  }

  const pageWidth = Math.max(200, (width - 24) * pane.scale);

  if (pane.missing) {
    return (
      <section className="pane">
        <div className="pane-header">
          <span className="pane-title" title={pane.name}>{pane.name}</span>
          <button className="close" title="移除该文件" onClick={onRemove}>×</button>
        </div>
        <div
          className="missing"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const f = e.dataTransfer.files[0];
            if (f) onMissingFile(f);
          }}
        >
          <p>本机找不到这份文件（PDF 只保存在原浏览器里）</p>
          <p className="missing-name">{pane.name}</p>
          <label className="btn">
            重新拖入或点击选择
            <input
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => {
                const f = e.target.files[0];
                if (f) onMissingFile(f);
                e.target.value = '';
              }}
            />
          </label>
          <p className="hint">批注都还在云端，文件恢复后会自动对应显示</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pane">
      <div className="pane-header">
        <span className="pane-title" title={pane.name}>{pane.name}</span>
        <div className="zoom-controls">
          <button onClick={() => onZoom(pane.scale - 0.25)} title="缩小">−</button>
          <span>{Math.round(pane.scale * 100)}%</span>
          <button onClick={() => onZoom(pane.scale + 0.25)} title="放大">＋</button>
          <button onClick={() => onZoom(1)}>重置</button>
        </div>
        <button className="close" title="移除该文件" onClick={onRemove}>×</button>
      </div>
      <div className={`pane-scroll ${annotateMode ? 'annotating' : ''}`} ref={scrollRef}>
        <Document
          file={pane.url}
          onLoadSuccess={({ numPages }) => onNumPages(numPages)}
          loading={<div className="hint">加载 PDF…</div>}
          error={<div className="hint">PDF 加载失败，请确认文件未损坏</div>}
        >
          {width > 0 && Array.from({ length: pane.numPages }, (_, i) => i + 1).map((page) => (
            <div
              key={page}
              className="page-wrap"
              ref={registerPageRef(`${pane.key}-${page}`)}
              onClick={(e) => handleClick(e, page)}
            >
              <Page
                pageNumber={page}
                width={pageWidth}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              <span className="page-num">第 {page} 页</span>
              {sorted.filter((a) => a.page === page).map((a) => (
                <Marker
                  key={a.id}
                  a={a}
                  label={numberOf(a.id)}
                  open={selectedId === a.id}
                  onSelect={onSelect}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
              {draft && draft.page === page && (
                <DraftMarker draft={draft} onCommit={onCommitDraft} onCancel={onCancelDraft} />
              )}
            </div>
          ))}
        </Document>
      </div>
    </section>
  );
}

function Marker({ a, label, open, onSelect, onUpdate, onDelete }) {
  const [text, setText] = useState(a.text);
  useEffect(() => {
    if (open) setText(a.text);
  }, [open, a.text]);

  return (
    <div className="marker" style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}>
      <button
        className={`dot ${open ? 'open' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSelect(open ? null : a.id); }}
      >
        {label}
      </button>
      {open && (
        <div
          className="popover"
          style={a.x > 0.6 ? { right: 0 } : { left: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <textarea value={text} rows={3} autoFocus onChange={(e) => setText(e.target.value)} />
          <div className="popover-actions">
            <button disabled={!text.trim()} onClick={() => onUpdate(a.id, text.trim())}>保存</button>
            <button className="danger" onClick={() => onDelete(a.id)}>删除</button>
          </div>
        </div>
      )}
    </div>
  );
}

function DraftMarker({ draft, onCommit, onCancel }) {
  const [text, setText] = useState('');
  return (
    <div className="marker draft" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}>
      <span className="dot">＋</span>
      <div
        className="popover"
        style={draft.x > 0.6 ? { right: 0 } : { left: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          value={text}
          placeholder="输入批注内容…"
          rows={3}
          autoFocus
          onChange={(e) => setText(e.target.value)}
        />
        <div className="popover-actions">
          <button disabled={!text.trim()} onClick={() => onCommit(text.trim())}>保存</button>
          <button onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
