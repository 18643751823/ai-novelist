import React, { memo, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    restoreMessages,
    setSessionHistory,
    setIsHistoryPanelVisible
} from '../../../store/slices/messageSlice';
import sessionService from '../../../services/sessionService';
import ConfirmationModal from '../../others/ConfirmationModal';
import './ChatHistoryPanel.css';

const ChatHistoryPanel = memo(({ history }) => {
    const dispatch = useDispatch();
    const { sessionHistory } = useSelector((state) => state.chat.message);
    
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [onConfirmCallback, setOnConfirmCallback] = useState(null);
    const [onCancelCallback, setOnCancelCallback] = useState(null);
    const [sessionIdToDelete, setSessionIdToDelete] = useState(null);

    const handleClosePanel = () => {
        dispatch(setIsHistoryPanelVisible(false));
    };

    const handleSelectConversation = useCallback(async (sessionId) => {
        try {
            // 获取会话消息
            const messagesResult = await sessionService.getSessionMessages(sessionId);
            if (messagesResult.success) {
                // 将消息转换为前端期望的格式
                const messages = messagesResult.messages.map(msg => {
                    // 将后端消息类型转换为前端角色
                    let role;
                    if (msg.message_type === 'human') {
                        role = 'user';
                    } else if (msg.message_type === 'ai') {
                        role = 'assistant';
                    } else {
                        role = msg.message_type; // 'tool' 或其他类型
                    }
                    
                    return {
                        id: msg.message_id || `msg_${msg.index}`,
                        role: role,
                        content: msg.content,
                        tool_calls: msg.tool_calls
                    };
                });
                
                dispatch(restoreMessages(messages));
                dispatch(setIsHistoryPanelVisible(false));
                
                console.log(`已加载会话 ${sessionId}，包含 ${messages.length} 条消息`);
            } else {
                console.error('加载会话消息失败:', messagesResult.error);
            }
        } catch (error) {
            console.error('选择会话失败:', error);
        }
    }, [dispatch]);

    const handleDeleteConversation = useCallback(async (sessionId) => {
        setSessionIdToDelete(sessionId);
        setConfirmationMessage('确定要删除此对话吗？');
        setOnConfirmCallback(() => async () => {
            setShowConfirmationModal(false);
            try {
                // 使用会话服务删除会话
                const result = await sessionService.deleteSession(sessionId);
                if (result.success) {
                    // 重新加载历史记录
                    const sessionsResult = await sessionService.listSessions();
                    if (sessionsResult.success) {
                        // 直接使用后端返回的会话数据
                        dispatch(setSessionHistory(sessionsResult.sessions));
                    }
                } else {
                    console.error('删除会话失败:', result.error);
                }
            } catch (error) {
                console.error('Error deleting conversation:', error);
            }
        });
        setOnCancelCallback(() => () => {
            setShowConfirmationModal(false);
            setSessionIdToDelete(null);
        });
        setShowConfirmationModal(true);
    }, [dispatch]);

    return (
        <div className="chat-history-panel">
            <h3>对话历史</h3>
            <button className="close-history-panel-button" onClick={handleClosePanel}>
                &times;
            </button>
            {!history || !Array.isArray(history) || history.length === 0 ? (
                <p className="no-history-message">暂无历史对话。</p>
            ) : (
                <ul className="history-list">
                    {console.log('ChatHistoryPanel received history (before map):', history)}
                    {history.map((session, index) => {
                        console.log(`Processing session[${index}]:`, session);
                        // 后端会话格式：session_id, created_at, last_accessed, message_count, is_current, preview
                        const sessionId = session.session_id || session.sessionId;
                        const messageCount = session.message_count || 0;
                        const createdAt = session.created_at || '';
                        const isCurrent = session.is_current || false;
                        const preview = session.preview || '';
                        
                        // 格式化创建时间
                        const formattedDate = createdAt ? new Date(createdAt).toLocaleString('zh-CN') : '未知时间';
                        
                        return (
                            <li key={sessionId} className={`history-item ${isCurrent ? 'current-session' : ''}`}>
                                <div
                                    className="history-text"
                                    onClick={() => handleSelectConversation(sessionId)}
                                >
                                    <div className="session-preview">{preview || `会话: ${sessionId}`}</div>
                                    <div className="session-info">
                                        <span className="message-count">{messageCount} 条消息</span>
                                        <span className="created-time">{formattedDate}</span>
                                    </div>
                                    {isCurrent && <span className="current-badge">当前</span>}
                                </div>
                                {!isCurrent && (
                                    <button
                                        className="delete-button"
                                        onClick={() => handleDeleteConversation(sessionId)}
                                        title="删除此会话"
                                    >
                                        &times;
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            {showConfirmationModal && (
                <ConfirmationModal
                    message={confirmationMessage}
                    onConfirm={onConfirmCallback}
                    onCancel={onCancelCallback}
                />
            )}
        </div>
    );
});

export default ChatHistoryPanel;
