import React, { memo, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    setIsHistoryPanelVisible,
    restoreMessages,
    setDeepSeekHistory
} from '../../../store/slices/chatSlice';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import ConfirmationModal from '../../others/ConfirmationModal';
import './ChatHistoryPanel.css';

const ChatHistoryPanel = memo(({ history }) => {
    const dispatch = useDispatch();
    const { deepSeekHistory } = useSelector((state) => state.chat);
    const { getDeepSeekChatHistory, deleteDeepSeekChatHistory } = useIpcRenderer();
    
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
            const conversation = deepSeekHistory.find(conv => conv.sessionId === sessionId);
            if (conversation) {
                dispatch(restoreMessages(conversation.messages));
                dispatch(setIsHistoryPanelVisible(false));
            }
        } catch (error) {
            console.error('Error selecting conversation:', error);
        }
    }, [dispatch, deepSeekHistory]);

    const handleDeleteConversation = useCallback(async (sessionId) => {
        setSessionIdToDelete(sessionId);
        setConfirmationMessage('确定要删除此对话吗？');
        setOnConfirmCallback(() => async () => {
            setShowConfirmationModal(false);
            try {
                await deleteDeepSeekChatHistory(sessionId);
                // 重新加载历史记录
                const updatedHistory = await getDeepSeekChatHistory();
                dispatch(setDeepSeekHistory(updatedHistory));
            } catch (error) {
                console.error('Error deleting conversation:', error);
            }
        });
        setOnCancelCallback(() => () => {
            setShowConfirmationModal(false);
            setSessionIdToDelete(null);
        });
        setShowConfirmationModal(true);
    }, [deleteDeepSeekChatHistory, getDeepSeekChatHistory, dispatch]);

    return (
        <div className="chat-history-panel">
            <h3>对话历史</h3>
            <button className="close-history-panel-button" onClick={handleClosePanel}>
                &times;
            </button>
            {history.length === 0 ? (
                <p className="no-history-message">暂无历史对话。</p>
            ) : (
                <ul className="history-list">
                    {console.log('ChatHistoryPanel received history (before map):', history)}
                    {history.map((conv, index) => {
                        console.log(`Processing conv[${index}]:`, conv);
                        console.log(`conv[${index}].messages:`, conv.messages);
                        return (
                            <li key={conv.sessionId} className="history-item">
                                <span onClick={() => handleSelectConversation(conv.sessionId)} className="history-text">
                                    {/* 检查 conv.messages 是否存在且为数组，并有内容。优先使用 content，否则使用 text */}
                                    {conv && conv.messages && Array.isArray(conv.messages) && conv.messages.length > 0 ?
                                        (conv.messages[0].content || conv.messages[0].text || '[无内容]').substring(0, 20) : '无内容'}...
                                </span>
                                <button
                                    className="delete-button"
                                    onClick={() => handleDeleteConversation(conv.sessionId)}
                                >
                                    &times;
                                </button>
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