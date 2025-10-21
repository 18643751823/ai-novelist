import React, { useEffect, useRef, useState } from 'react';
import './NotificationModal.css'; // 复用 NotificationModal 的样式

const ConfirmationModal = ({ message, onConfirm, onCancel }) => {
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const [focusedButton, setFocusedButton] = useState('confirm'); // 'confirm' or 'cancel'

  useEffect(() => {
    // 确保在模态框首次渲染或focusedButton改变时，正确的按钮获得焦点
    if (focusedButton === 'confirm') {
      confirmButtonRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [focusedButton]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); // 阻止默认的滚动行为
        setFocusedButton((prev) => (prev === 'confirm' ? 'cancel' : 'confirm'));
      } else if (event.key === 'Enter') {
        event.preventDefault(); // 阻止默认的表单提交行为
        if (focusedButton === 'confirm') {
          onConfirm();
        } else {
          onCancel();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel(); // Esc 键触发取消操作
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusedButton, onConfirm, onCancel]); // 依赖项中包含 onConfirm 和 onCancel

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <div className="modal-actions">
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={focusedButton === 'confirm' ? 'focused' : ''}
            tabIndex={0} // 确保按钮可以通过 Tab 键获得焦点
          >
            确定
          </button>
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className={focusedButton === 'cancel' ? 'focused' : ''}
            tabIndex={0} // 确保按钮可以通过 Tab 键获得焦点
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;