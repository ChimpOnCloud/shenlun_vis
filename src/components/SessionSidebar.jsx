export default function SessionSidebar({ sessions, currentId, onOpen, onDelete, onNew, onRename }) {
  return (
    <aside className="sidebar">
      <button className="btn new-session" onClick={onNew}>＋ 新建对比</button>
      <h2>已保存（{sessions.length}）</h2>
      {sessions.length === 0 && (
        <p className="hint">还没有保存过的对比。拖入 PDF 后点「保存到云端」，这里就会出现一条记录。</p>
      )}
      <ul>
        {sessions.map((s) => (
          <li key={s.id} className={s.id === currentId ? 'active' : ''}>
            <button className="session-item" onClick={() => onOpen(s)}>
              <span className="session-name">{s.name}</span>
              <span className="session-meta">
                {(s.files || []).length} 份文件
                {s.createdAt?.toDate
                  ? ` · ${s.createdAt.toDate().toLocaleDateString('zh-CN')}`
                  : s.createdAt ? ` · ${new Date(s.createdAt).toLocaleDateString('zh-CN')}` : ''}
              </span>
            </button>
            <button className="session-edit" title="重命名" onClick={() => onRename(s)}>✎</button>
            <button className="session-del" title="删除该对比" onClick={() => onDelete(s)}>×</button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
