import React from 'react';
import { diffChars } from 'diff';
import './DiffViewer.css';

function DiffViewer({ originalContent, currentContent }) {
  const changes = diffChars(originalContent || '', currentContent || '');

  const renderDiffContent = (changes, showAdded = false, showRemoved = false) => {
    return changes.map((part, index) => {
      const { value, added, removed } = part;
      
      if (added && showAdded) {
        return <span key={index} className="diff-added">{value}</span>;
      } else if (removed && showRemoved) {
        return <span key={index} className="diff-removed">{value}</span>;
      } else if (!added && !removed) {
        return <span key={index}>{value}</span>;
      }
      return null;
    });
  };

  return (
    <div className="diff-viewer-container">
      <div className="diff-panel">
        <div className="panel-title">原始版本</div>
        <div className="diff-editor">
          <pre className="diff-content">
            {renderDiffContent(changes, false, true)}
          </pre>
        </div>
      </div>
      <div className="diff-panel">
        <div className="panel-title">修改后版本</div>
        <div className="diff-editor">
          <pre className="diff-content">
            {renderDiffContent(changes, true, false)}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default DiffViewer;