import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setRetrievalTopK } from '../../store/slices/chatSlice';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import './RetrievalSettings.css';

const RetrievalSettings = () => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  
  const [localTopK, setLocalTopK] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 加载检索设置
  const loadRetrievalSettings = useCallback(async () => {
    try {
      setLoading(true);
      const result = await invoke('get-retrieval-top-k');
      if (result.success) {
        setLocalTopK(result.topK || 3);
        dispatch(setRetrievalTopK(result.topK || 3));
      } else {
        console.warn('获取检索设置失败:', result.error);
        // 使用默认值
        setLocalTopK(3);
        dispatch(setRetrievalTopK(3));
      }
    } catch (error) {
      console.error('加载检索设置失败:', error);
      setError('加载检索设置失败');
      // 使用默认值
      setLocalTopK(3);
      dispatch(setRetrievalTopK(3));
    } finally {
      setLoading(false);
    }
  }, [invoke, dispatch]);

  // 保存检索设置
  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // 验证输入
      const topK = parseInt(localTopK);
      if (isNaN(topK) || topK <= 0 || topK > 20) {
        setError('返回文档片段数必须是1-20之间的整数');
        return;
      }

      // 保存到后端
      const result = await invoke('set-retrieval-top-k', topK);
      if (result.success) {
        dispatch(setRetrievalTopK(topK));
        setSuccess(`已成功设置返回 ${topK} 个文档片段`);
        
        // 3秒后清除成功消息
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(`保存失败: ${result.error}`);
      }
    } catch (error) {
      console.error('保存检索设置失败:', error);
      setError(`保存失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载设置
  useEffect(() => {
    loadRetrievalSettings();
  }, [loadRetrievalSettings]);

  // 处理输入变化
  const handleTopKChange = (e) => {
    const value = e.target.value;
    setLocalTopK(value);
    setError('');
  };

  // 处理键盘事件
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="retrieval-settings">
      <div className="settings-section">
        <h4>检索设置</h4>
        
        <div className="setting-item">
          <label htmlFor="retrievalTopK">返回文档片段数:</label>
          <div className="topk-input-container">
            <input
              type="number"
              id="retrievalTopK"
              value={localTopK}
              onChange={handleTopKChange}
              onKeyPress={handleKeyPress}
              min="1"
              max="20"
              step="1"
              className={`topk-input ${error ? 'error' : ''}`}
              placeholder="1-20"
              disabled={loading}
            />
            <button
              onClick={handleSave}
              disabled={loading}
              className="save-topk-button"
            >
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
          {error && (
            <div className="error-message">{error}</div>
          )}
          {success && (
            <div className="success-message">{success}</div>
          )}
          <div className="setting-description">
            每次RAG检索时返回的最相关文档片段数量（默认：3，范围：1-20）
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetrievalSettings;