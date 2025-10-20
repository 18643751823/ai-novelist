import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import './RenameKbFileModal.css';

const RenameKbFileModal = ({ isOpen, onClose, file, onRename }) => {
  const [newFilename, setNewFilename] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && file) {
      setNewFilename(file.filename);
      setError('');
    }
  }, [isOpen, file]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newFilename.trim()) {
      setError('文件名不能为空');
      return;
    }

    if (newFilename === file.filename) {
      setError('新文件名不能与原文件名相同');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onRename(file.filename, newFilename.trim());
      onClose();
    } catch (err) {
      setError(err.message || '重命名失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNewFilename('');
    setError('');
    setLoading(false);
    onClose();
  };

  if (!isOpen || !file) return null;

  return (
    <div className="rename-kb-modal-overlay">
      <div className="rename-kb-modal">
        <div className="rename-kb-modal-header">
          <h3>重命名知识库文件</h3>
          <button className="close-btn" onClick={handleClose} disabled={loading}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="rename-kb-modal-body">
          <div className="file-info">
            <p><strong>原文件名:</strong> {file.filename}</p>
            <p><strong>文档片段:</strong> {file.documentCount} 个</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="newFilename">新文件名:</label>
              <input
                id="newFilename"
                type="text"
                value={newFilename}
                onChange={(e) => setNewFilename(e.target.value)}
                placeholder="请输入新文件名"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-actions">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="cancel-btn"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={loading || !newFilename.trim() || newFilename === file.filename}
                className="confirm-btn"
              >
                {loading ? '重命名中...' : '确认重命名'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RenameKbFileModal;