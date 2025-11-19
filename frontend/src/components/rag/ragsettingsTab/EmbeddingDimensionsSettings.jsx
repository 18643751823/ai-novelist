import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../../../hooks/useIpcRenderer';

// 嵌入向量维度设置组件
const EmbeddingDimensionsSettings = ({ 
  embeddingModel, 
  onDimensionsChange, 
  onSaveComplete 
}) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  
  const [localEmbeddingDimensions, setLocalEmbeddingDimensions] = useState(1024);
  const [modelDefaultDimensions, setModelDefaultDimensions] = useState(1024);
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(false);

  // 加载嵌入维度设置
  const loadEmbeddingDimensions = useCallback(async () => {
    try {
      setIsLoadingDimensions(true);
      
      // 从存储加载嵌入维度
      if (embeddingModel) {
        try {
          const modelDimensions = await invoke('get-embedding-dimensions', embeddingModel);
          if (modelDimensions.success) {
            const storedDimensions = modelDimensions.dimensions || 1024;
            setLocalEmbeddingDimensions(storedDimensions);
            setModelDefaultDimensions(storedDimensions);
          }
        } catch (error) {
          console.warn('获取模型默认维度失败:', error);
          setLocalEmbeddingDimensions(1024);
          setModelDefaultDimensions(1024);
        }
      } else {
        // 如果没有选择模型，使用默认维度
        setLocalEmbeddingDimensions(1024);
        setModelDefaultDimensions(1024);
      }
    } catch (error) {
      console.error('加载嵌入维度设置失败:', error);
    } finally {
      setIsLoadingDimensions(false);
    }
  }, [embeddingModel, invoke]);

  // 当嵌入模型变化时，自动获取默认维度
  useEffect(() => {
    const updateModelDefaultDimensions = async () => {
      if (embeddingModel) {
        setIsLoadingDimensions(true);
        try {
          const modelDimensions = await invoke('get-embedding-dimensions', embeddingModel);
          if (modelDimensions.success) {
            const defaultDimensions = modelDimensions.dimensions;
            setModelDefaultDimensions(defaultDimensions);
            
            // 更新为模型默认值
            setLocalEmbeddingDimensions(defaultDimensions);
            // 通知父组件维度变化
            if (onDimensionsChange) {
              onDimensionsChange(defaultDimensions);
            }
          }
        } catch (error) {
          console.warn('获取模型默认维度失败:', error);
          setModelDefaultDimensions(1024);
          setLocalEmbeddingDimensions(1024);
          if (onDimensionsChange) {
            onDimensionsChange(1024);
          }
        } finally {
          setIsLoadingDimensions(false);
        }
      }
    };

    // 添加防抖，避免频繁调用
    const timeoutId = setTimeout(updateModelDefaultDimensions, 500);
    return () => clearTimeout(timeoutId);
  }, [embeddingModel, invoke, onDimensionsChange]);

  // 初始化加载设置
  useEffect(() => {
    loadEmbeddingDimensions();
  }, [loadEmbeddingDimensions]);

  
  return (
    <div className="embedding-dimensions-settings">
      <div className="setting-item">
        <label htmlFor="embeddingDimensions">嵌入向量维度:</label>
        <div className="embedding-dimensions-container">
          {isLoadingDimensions ? (
            <div className="dimensions-loading">
              <FontAwesomeIcon icon={faSync} spin />
              <span>获取嵌入向量维度中...</span>
            </div>
          ) : (
            <>
              <input
                type="text"
                id="embeddingDimensions"
                value={localEmbeddingDimensions}
                disabled
                className="embedding-dimensions-input disabled"
                placeholder="暂时不可自定义"
              />
              <div className="disabled-note">暂时不可自定义</div>
            </>
          )}
        </div>
        <div className="setting-description">
          嵌入向量的维度大小（常见值：512, 768, 1024, 1536, 2048）
        </div>
        {!isLoadingDimensions && embeddingModel && (
          <span style={{color: '#28a745', fontWeight: 'bold'}}>
            （当前使用模型默认值：{modelDefaultDimensions}）
        </span>
        )}
      </div>
    </div>
  );
};

export default EmbeddingDimensionsSettings;