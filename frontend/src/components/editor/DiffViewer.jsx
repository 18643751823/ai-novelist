import React, { useRef, useEffect, useState } from 'react';
import { diffChars } from 'diff';
import VditorEditor from './VditorEditor';
import './DiffViewer.css';

function DiffViewer({ originalContent, currentContent }) {
  const leftEditorRef = useRef(null);
  const rightEditorRef = useRef(null);
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');

  useEffect(() => {
    const changes = diffChars(originalContent || '', currentContent || '');
    
    // 构建左侧内容（原始版本，显示删除）
    const leftText = changes.map(part => {
      if (part.removed) {
        return `<span class="diff-removed">${part.value}</span>`;
      } else if (!part.added) {
        return part.value;
      }
      return '';
    }).join('');
    
    // 构建右侧内容（修改后版本，显示新增）
    const rightText = changes.map(part => {
      if (part.added) {
        return `<span class="diff-added">${part.value}</span>`;
      } else if (!part.removed) {
        return part.value;
      }
      return '';
    }).join('');
    
    setLeftContent(leftText);
    setRightContent(rightText);
  }, [originalContent, currentContent]);

  return (
    <div className="diff-viewer-container">
      <div className="diff-panel">
        <div className="panel-title">原始版本</div>
        <div className="diff-editor">
          <VditorEditor
            ref={leftEditorRef}
            value={originalContent || ''}
            mode="ir"
            placeholder=""
            onInstanceReady={(instance) => {
              // 设置为只读模式
              if (instance && instance.vditor) {
                instance.vditor.disabled = true;
              }
            }}
          />
        </div>
      </div>
      <div className="diff-panel">
        <div className="panel-title">修改后版本</div>
        <div className="diff-editor">
          <VditorEditor
            ref={rightEditorRef}
            value={currentContent || ''}
            mode="ir"
            placeholder=""
            onInstanceReady={(instance) => {
              // 设置为只读模式
              if (instance && instance.vditor) {
                instance.vditor.disabled = true;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default DiffViewer;