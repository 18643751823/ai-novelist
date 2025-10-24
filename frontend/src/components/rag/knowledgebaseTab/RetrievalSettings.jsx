import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setRagRetrievalTopK } from '../../../store/slices/chatSlice';
import './RetrievalSettings.css';

const RetrievalSettings = ({ retrievalTopK = 3 }) => {
  const dispatch = useDispatch();
  
  const [localTopK, setLocalTopK] = useState(retrievalTopK);
  const [error, setError] = useState('');

  // 当props中的retrievalTopK变化时更新本地状态
  useEffect(() => {
    setLocalTopK(retrievalTopK);
  }, [retrievalTopK]);

  // 处理输入变化
  const handleTopKChange = (e) => {
    const value = e.target.value;
    setLocalTopK(value);
    setError('');
    
    // 实时更新Redux状态
    const topK = parseInt(value);
    if (!isNaN(topK) && topK > 0 && topK <= 20) {
      dispatch(setRagRetrievalTopK(topK));
    } else {
      setError('返回文档片段数必须是1-20之间的整数');
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
              min="1"
              max="20"
              step="1"
              className={`topk-input ${error ? 'error' : ''}`}
              placeholder="1-20"
            />
          </div>
          {error && (
            <div className="error-message">{error}</div>
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