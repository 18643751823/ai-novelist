import React from 'react';
import { useDispatch } from 'react-redux';
import { restoreMessages } from '../../store/slices/chatSlice';
import checkpointService from '../../../services/checkpointService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload } from '@fortawesome/free-solid-svg-icons';

// 检查点消息组件
const CheckpointMessage = ({ 
  msg, 
  currentSessionIdRef,
  onSetConfirmation,
  onSetNotification 
}) => {
  const dispatch = useDispatch();

  const handleRestoreCheckpoint = () => {
    onSetConfirmation({
      message: '是否回档，后续内容将会清空！',
      onConfirm: async () => {
        const taskId = msg.sessionId || currentSessionIdRef?.current || 'default-task';
        console.log(`Restoring checkpoint ${msg.checkpointId} for task ${taskId}...`);
        const result = await checkpointService.restoreCheckpoint(msg.checkpointId);
        if (result.success) {
          // **关键修复**: 调用新的 restoreMessages action 来重构历史状态
          if (result.messages) {
            dispatch(restoreMessages(result.messages));
          }
          onSetNotification({ show: true, message: '回档成功！聊天记录已恢复。' });
        } else {
          onSetNotification({ show: true, message: `恢复失败: ${result.error || '未知错误'}` });
        }
        onSetConfirmation({ show: false });
      },
      onCancel: () => onSetConfirmation({ show: false })
    });
  };

  return (
    <div className="checkpoint-message">
      <button
        className="checkpoint-restore-button"
        onClick={handleRestoreCheckpoint}
      >
        <FontAwesomeIcon icon={faClock} />
      </button>
      <span className="checkpoint-id-display">ID: {msg.checkpointId.substring(0, 7)}</span>
    </div>
  );
};

export default CheckpointMessage;