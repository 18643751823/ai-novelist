import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setRagChunkSettings } from '../../../store/slices/chatSlice';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import './TextChunkingSettings.css';

// 文本分段参数组件
const TextChunkingSettings = forwardRef(({ onSaveComplete, chunkSize = 400, chunkOverlap = 50 }, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  
  const [localChunkSize, setLocalChunkSize] = useState(chunkSize);
  const [localChunkOverlap, setLocalChunkOverlap] = useState(chunkOverlap);
  const [chunkSizeError, setChunkSizeError] = useState('');
  const [chunkOverlapError, setChunkOverlapError] = useState('');
  const [chunkValidationError, setChunkValidationError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 当props中的chunkSize和chunkOverlap变化时更新本地状态
  useEffect(() => {
    setLocalChunkSize(chunkSize);
    setLocalChunkOverlap(chunkOverlap);
  }, [chunkSize, chunkOverlap]);

  // 保存分段参数设置
  const handleSave = async () => {
    // 检查验证错误
    if (chunkSizeError || chunkOverlapError || chunkValidationError) {
      if (onSaveComplete) {
        onSaveComplete('请先修正输入错误', false);
      }
      return;
    }

    // 检查必填字段
    if (localChunkSize === '' || localChunkOverlap === '') {
      if (onSaveComplete) {
        onSaveComplete('文本分段参数不能为空', false);
      }
      return;
    }

    // 检查分段参数是否大于重叠大小
    if (localChunkSize <= localChunkOverlap) {
      if (onSaveComplete) {
        onSaveComplete('文本分段大小必须大于文本重叠大小', false);
      }
      return;
    }

    try {
      // 保存分段参数到后端
      await invoke('set-rag-chunk-settings', localChunkSize, localChunkOverlap);
      
      // 同时更新Redux状态，确保状态同步
      dispatch(setRagChunkSettings({
        chunkSize: localChunkSize,
        chunkOverlap: localChunkOverlap
      }));
      
      if (onSaveComplete) {
        onSaveComplete('文本分段参数保存成功！', true);
      }
    } catch (error) {
      console.error('保存分段参数设置失败:', error);
      if (onSaveComplete) {
        onSaveComplete('文本分段参数保存失败，请重试。', false);
      }
    }
  };

  // 验证分段参数关系
  const validateChunkRelationship = (chunkSize, chunkOverlap) => {
    if (chunkSize && chunkOverlap && chunkSize <= chunkOverlap) {
      setChunkValidationError('文本分段大小必须大于文本重叠大小');
    } else {
      setChunkValidationError('');
    }
  };

  // 处理分块大小变化
  const handleChunkSizeChange = (value) => {
    if (value === '') {
      setChunkSizeError('不能为空');
      setLocalChunkSize('');
    } else if (!/^\d+$/.test(value)) {
      setChunkSizeError('不能包含非数字');
      setLocalChunkSize(value);
    } else {
      setChunkSizeError('');
      const newChunkSize = parseInt(value);
      setLocalChunkSize(newChunkSize);
      validateChunkRelationship(newChunkSize, localChunkOverlap);
      
      // 实时更新Redux状态
      dispatch(setRagChunkSettings({
        chunkSize: newChunkSize,
        chunkOverlap: localChunkOverlap
      }));
    }
  };

  // 处理重叠大小变化
  const handleChunkOverlapChange = (value) => {
    if (value === '') {
      setChunkOverlapError('不能为空');
      setLocalChunkOverlap('');
    } else if (!/^\d+$/.test(value)) {
      setChunkOverlapError('不能包含非数字');
      setLocalChunkOverlap(value);
    } else {
      setChunkOverlapError('');
      const newChunkOverlap = parseInt(value);
      setLocalChunkOverlap(newChunkOverlap);
      validateChunkRelationship(localChunkSize, newChunkOverlap);
      
      // 实时更新Redux状态
      dispatch(setRagChunkSettings({
        chunkSize: localChunkSize,
        chunkOverlap: newChunkOverlap
      }));
    }
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSave
  }));

  return (
    <div className="text-chunking-settings">
      <h5>文本分段参数</h5>
      
      <div className="setting-item">
        <label htmlFor="ragChunkSize">文本分段大小:</label>
        <input
          type="text"
          id="ragChunkSize"
          value={localChunkSize}
          onChange={(e) => handleChunkSizeChange(e.target.value)}
          className={`chunk-size-input ${chunkSizeError ? 'error' : ''}`}
          placeholder="请输入数字"
        />
        {chunkSizeError && (
          <div className="error-message">{chunkSizeError}</div>
        )}
        <div className="setting-description">
          每个文本片段的最大字符数（建议400-800）
        </div>
      </div>

      <div className="setting-item">
        <label htmlFor="ragChunkOverlap">文本重叠大小:</label>
        <input
          type="text"
          id="ragChunkOverlap"
          value={localChunkOverlap}
          onChange={(e) => handleChunkOverlapChange(e.target.value)}
          className={`chunk-overlap-input ${chunkOverlapError ? 'error' : ''}`}
          placeholder="请输入数字"
        />
        {chunkOverlapError && (
          <div className="error-message">{chunkOverlapError}</div>
        )}
        {chunkValidationError && (
          <div className="error-message">{chunkValidationError}</div>
        )}
        <div className="setting-description">
          片段之间的重叠字符数（建议50-100）
        </div>
      </div>
    </div>
  );
});

export default TextChunkingSettings;