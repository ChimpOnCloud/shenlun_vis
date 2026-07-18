import { useState } from 'react';

export default function DropZone({ onFiles }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <p className="dropzone-title">把 2–3 份 PDF 拖到这里，开始并排对比</p>
      <p className="dropzone-sub">支持随时缩放、批注，批注自动保存</p>
      <label className="btn">
        或点击选择文件
        <input
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
        />
      </label>
    </div>
  );
}
