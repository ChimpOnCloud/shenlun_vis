export default function AnnotationPanel({ panes, annotations, onLocate, onDelete }) {
  const nameOf = (key) => panes.find((p) => p.key === key)?.name || '已移除文件';
  const sorted = [...annotations].sort((a, b) => (
    nameOf(a.fileKey).localeCompare(nameOf(b.fileKey), 'zh') || a.page - b.page
  ));

  return (
    <aside className="panel">
      <h2>批注列表（{annotations.length}）</h2>
      {sorted.length === 0 && (
        <p className="hint">
          还没有批注。点击上方「添加批注」，然后在 PDF 任意位置点击即可留下文字批注。
        </p>
      )}
      <ul>
        {sorted.map((a) => (
          <li key={a.id}>
            <div className="meta">{nameOf(a.fileKey)} · 第 {a.page} 页</div>
            <div className="text">{a.text}</div>
            <div className="actions">
              <button onClick={() => onLocate(a)}>定位</button>
              <button className="danger" onClick={() => onDelete(a.id)}>删除</button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
