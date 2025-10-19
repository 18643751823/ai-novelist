import React, { useEffect } from 'react';
import './NotificationModal.css';

const NotificationModal = ({ message, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') { // 同时支持回车和Esc键关闭
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]); // 依赖项为 onClose

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <button onClick={onClose}>确定</button>
      </div>
    </div>
  );
};

export default NotificationModal;