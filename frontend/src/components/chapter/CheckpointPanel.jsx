import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import checkpointService from '../../services/checkpointService';
import './CheckpointPanel.css';
import ConfirmationModal from '../others/ConfirmationModal';
import { triggerChapterRefresh } from '../../store/slices/novelSlice';

const CheckpointPanel = ({ onClose }) => {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [onConfirm, setOnConfirm] = useState(null);
    const currentTaskId = useSelector(state => state.novel.currentTaskId || 'default-task');
    const dispatch = useDispatch();

    const loadHistory = useCallback(async () => {
        if (!currentTaskId) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await checkpointService.listNovelArchives(currentTaskId);
            if (result.success) {
                setHistory(result.data || []);
            } else {
                setError('加载历史记录失败：' + result.error);
            }
        } catch (err) {
            setError('加载历史记录失败。');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [currentTaskId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const handleSaveArchive = async () => {
        if (!currentTaskId) return;
        const message = `存档于 ${new Date().toLocaleString()}`;
        setIsLoading(true);
        try {
            // 使用相对于后端根目录的工作目录路径
            const workspaceDir = 'novel';
            const result = await checkpointService.createNovelArchive(currentTaskId, workspaceDir, message);
            if (result.success) {
                await loadHistory();
            } else {
                setError('保存存档失败：' + result.error);
            }
        } catch (err) {
            setError('保存存档失败。');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreArchive = (archiveId) => {
        setConfirmationMessage('当前操作可能使得内容丢失，请提前存档。\n\n确定要恢复到这个存档吗？');
        setOnConfirm(() => async () => {
            setShowConfirmation(false);
            setIsLoading(true);
            try {
                // 使用相对于后端根目录的工作目录路径
                const workspaceDir = 'novel';
                const result = await checkpointService.restoreNovelArchive(currentTaskId, archiveId, workspaceDir);
                if (result.success) {
                    dispatch(triggerChapterRefresh());
                    setSuccess('存档恢复成功！');
                    // 3秒后自动隐藏成功提示
                    setTimeout(() => setSuccess(null), 3000);
                } else {
                    setError('恢复存档失败：' + result.error);
                }
            } catch (err) {
                setError('恢复存档失败。');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        });
        setShowConfirmation(true);
    };

    const handleDeleteArchive = (archiveId) => {
        setConfirmationMessage('确定要永久删除这个存档吗？\n\n此操作不可撤销。');
        setOnConfirm(() => async () => {
            setShowConfirmation(false);
            setIsLoading(true);
            try {
                const result = await checkpointService.deleteNovelArchive(currentTaskId, archiveId);
                if (result.success) {
                    await loadHistory();
                } else {
                    setError('删除存档失败：' + result.error);
                }
            } catch (err) {
                setError('删除存档失败。');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        });
        setShowConfirmation(true);
    };

    return (
        <>
            <div className="checkpoint-panel">
                <div className="checkpoint-panel-header">
                    <h3>版本历史</h3>
                </div>
                <div className="checkpoint-panel-controls">
                    <button onClick={handleSaveArchive} disabled={isLoading}>
                        {isLoading ? '处理中...' : '创建新存档'}
                    </button>
                    {onClose && <button onClick={onClose} className="button-secondary">退出</button>}
                </div>
                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}
                <ul className="checkpoint-history">
                    {history.map((item) => (
                        <li key={item.id}>
                            <div className="checkpoint-info">
                                <strong>{item.message}</strong>
                                <span>{new Date(item.id.split('_')[0]).toLocaleString()}</span>
                                <small>ID: {item.id.substring(0, 10)}...</small>
                            </div>
                            <div className="checkpoint-actions">
                                <button onClick={() => handleDeleteArchive(item.id)} disabled={isLoading} className="button-delete">删除</button>
                                <button onClick={() => handleRestoreArchive(item.id)} disabled={isLoading}>恢复</button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            {showConfirmation && (
                <ConfirmationModal
                    message={confirmationMessage}
                    onConfirm={onConfirm}
                    onCancel={() => setShowConfirmation(false)}
                />
            )}
        </>
    );
};

export default CheckpointPanel;