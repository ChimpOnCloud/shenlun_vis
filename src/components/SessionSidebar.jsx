import { useState } from 'react';
import { CATEGORIES } from '../cloud-db';

export default function SessionSidebar({
  sessions, currentId, onOpen, onDelete, onNew, onRename, onMoveCategory,
}) {
  const [collapsed, setCollapsed] = useState({});

  const groups = CATEGORIES.map((c) => ({ name: c, items: [] }));
  const uncategorized = [];
  for (const s of sessions) {
    const g = groups.find((x) => x.name === s.category);
    if (g) g.items.push(s);
    else uncategorized.push(s);
  }
  if (uncategorized.length) groups.push({ name: '未分类', items: uncategorized });

  const toggle = (name) => setCollapsed((c) => ({ ...c, [name]: !c[name] }));

  const renderItem = (s) => (
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
      <button className="session-edit" title="移动到别的分类" onClick={() => onMoveCategory(s)}>⇄</button>
      <button className="session-edit" title="重命名" onClick={() => onRename(s)}>✎</button>
      <button className="session-del" title="删除该对比" onClick={() => onDelete(s)}>×</button>
    </li>
  );

  return (
    <aside className="sidebar">
      <button className="btn new-session" onClick={onNew}>＋ 新建对比</button>
      <h2>已保存（{sessions.length}）</h2>
      {sessions.length === 0 && (
        <p className="hint">还没有保存过的对比。拖入 PDF 后点「保存到云端」，这里就会出现一条记录。</p>
      )}
      {groups.map((g) => (
        <div className="cat-group" key={g.name}>
          <button className="cat-header" onClick={() => toggle(g.name)}>
            <span className="cat-arrow">{collapsed[g.name] ? '▸' : '▾'}</span>
            {g.name}
            <span className="cat-count">{g.items.length}</span>
          </button>
          {!collapsed[g.name] && (
            g.items.length
              ? <ul>{g.items.map(renderItem)}</ul>
              : <p className="cat-empty">暂无对比</p>
          )}
        </div>
      ))}
    </aside>
  );
}
