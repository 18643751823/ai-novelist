import React, { memo } from 'react';
import { useDispatch } from 'react-redux'; // 导入 useDispatch
import { setIsHistoryPanelVisible } from '../../store/slices/chatSlice'; // 导入对应的 action
import './ChatHistoryPanel.css';

const ChatHistoryPanel = memo(({ history, onSelectConversation, onDeleteConversation }) => {
    const dispatch = useDispatch(); // 获取 dispatch 函数

    const handleClosePanel = () => {
        dispatch(setIsHistoryPanelVisible(false)); // 关闭历史面板
    };

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
                                <span onClick={() => onSelectConversation(conv.sessionId)} className="history-text">
                                    {/* 检查 conv.messages 是否存在且为数组，并有内容。优先使用 content，否则使用 text */}
                                    {conv && conv.messages && Array.isArray(conv.messages) && conv.messages.length > 0 ?
                                        (conv.messages[0].content || conv.messages[0].text || '[无内容]').substring(0, 20) : '无内容'}...
                                </span>
                                <button
                                    className="delete-button"
                                    onClick={() => onDeleteConversation(conv.sessionId)}
                                >
                                    &times;
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
});

export default ChatHistoryPanel;