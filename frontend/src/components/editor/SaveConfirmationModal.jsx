import React, { useEffect, useRef, useState } from 'react';
import '../others/NotificationModal.css'; // 复用 NotificationModal 的样式

const SaveConfirmationModal = ({ 
  message, 
  onSave, 
  onDiscard, 
  onCancel 
}) => {
  const saveButtonRef = useRef(null);
  const discardButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const [focusedButton, setFocusedButton] = useState('save'); // 'save', 'discard', or 'cancel'

  useEffect(() => {
    // 确保在模态框首次渲染或focusedButton改变时，正确的按钮获得焦点
    if (focusedButton === 'save') {
      saveButtonRef.current?.focus();
    } else if (focusedButton === 'discard') {
      discardButtonRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [focusedButton]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // 三个按钮的键盘导航
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setFocusedButton((prev) => {
          if (prev === 'save') return 'cancel';
          if (prev === 'discard') return 'save';
          if (prev === 'cancel') return 'discard';
          return prev;
        });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setFocusedButton((prev) => {
          if (prev === 'save') return 'discard';
          if (prev === 'discard') return 'cancel';
          if (prev === 'cancel') return 'save';
          return prev;
        });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (focusedButton === 'save') {
          onSave();
        } else if (focusedButton === 'discard') {
          onDiscard();
        } else {
          onCancel();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedButton, onSave, onDiscard, onCancel]);

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <div className="modal-actions">
          <button
            ref={saveButtonRef}
            onClick={onSave}
            className={focusedButton === 'save' ? 'focused' : ''}
            tabIndex={0}
          >
            保存
          </button>
          <button
            ref={discardButtonRef}
            onClick={onDiscard}
            className={focusedButton === 'discard' ? 'focused' : ''}
            tabIndex={0}
          >
            丢弃
          </button>
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className={focusedButton === 'cancel' ? 'focused' : ''}
            tabIndex={0}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveConfirmationModal;