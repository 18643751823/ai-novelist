import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setIntentAnalysisModel, setRagIntentAnalysisSettings } from '../../../store/slices/chatSlice';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import './IntentAnalysisSettings.css';

// 意图分析设置组件
const IntentAnalysisSettings = forwardRef(({
  onSaveComplete,
  intentAnalysisModel = '',
  intentAnalysisPrompt = '',
  availableModels = []
}, ref) => {
  const dispatch = useDispatch();
  const { invoke, setStoreValue } = useIpcRenderer();
  
  const [localIntentModel, setLocalIntentModel] = useState(intentAnalysisModel);
  const [localIntentPrompt, setLocalIntentPrompt] = useState(intentAnalysisPrompt);

  // 当props中的intentAnalysisModel和intentAnalysisPrompt变化时更新本地状态
  useEffect(() => {
    setLocalIntentModel(intentAnalysisModel);
    setLocalIntentPrompt(intentAnalysisPrompt);
  }, [intentAnalysisModel, intentAnalysisPrompt]);

  // 保存意图分析设置
  const handleSaveIntentAnalysis = async () => {
    try {
      // 保存意图分析模型到后端
      if (localIntentModel) {
        const modelResult = await invoke('set-intent-analysis-model', localIntentModel);
        if (!modelResult.success) {
          throw new Error(modelResult.error || '设置意图分析模型失败');
        }
      }
      
      // 保存意图分析模型到Redux状态和存储
      dispatch(setIntentAnalysisModel(localIntentModel));
      await setStoreValue('intentAnalysisModel', localIntentModel);
      
      // 保存自定义提示词
      if (localIntentPrompt.trim()) {
        const promptResult = await invoke('set-intent-analysis-prompt', localIntentPrompt.trim());
        if (!promptResult.success) {
          throw new Error(promptResult.error || '设置意图分析提示词失败');
        }
      } else {
        // 如果提示词为空，重置为默认值
        const resetResult = await invoke('reset-intent-analysis-prompt');
        if (!resetResult.success) {
          throw new Error(resetResult.error || '重置意图分析提示词失败');
        }
      }
      
      if (onSaveComplete) {
        onSaveComplete('意图分析设置保存成功！', true);
      }
    } catch (error) {
      console.error('保存意图分析设置失败:', error);
      if (onSaveComplete) {
        onSaveComplete(`意图分析设置保存失败: ${error.message}`, false);
      }
    }
  };

  // 重置提示词为默认值
  const handleResetPrompt = async () => {
    try {
      const result = await invoke('reset-intent-analysis-prompt');
      if (result.success) {
        setLocalIntentPrompt(result.prompt || '');
        if (onSaveComplete) {
          onSaveComplete('提示词已重置为默认值！', true);
        }
      }
    } catch (error) {
      console.error('重置提示词失败:', error);
      if (onSaveComplete) {
        onSaveComplete('重置提示词失败，请重试。', false);
      }
    }
  };
  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSaveIntentAnalysis
  }));

  return (
    <div className="intent-analysis-settings">
      <h5>意图分析模型配置</h5>
      
      <div className="setting-item">
        <label htmlFor="intentAnalysisModel">意图分析模型:</label>
        <select
          id="intentAnalysisModel"
          value={localIntentModel || ''}
          onChange={(e) => {
            const newModel = e.target.value;
            setLocalIntentModel(newModel);
            // 实时更新Redux状态 - 同时更新根级别和RAG统一状态
            dispatch(setIntentAnalysisModel(newModel));
            dispatch(setRagIntentAnalysisSettings({
              intentAnalysisModel: newModel,
              intentAnalysisPrompt: localIntentPrompt
            }));
          }}
        >
          <option value="">使用默认模型（自动选择）</option>
          {availableModels.map(model => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))}
        </select>
        <div className="setting-description">
          用于分析写作意图和生成检索词的AI模型
        </div>
      </div>

      <div className="setting-item">
        <label htmlFor="intentAnalysisPrompt">意图分析提示词:</label>
        <div className="prompt-input-container">
          <textarea
            id="intentAnalysisPrompt"
            value={localIntentPrompt}
            onChange={(e) => {
              const newPrompt = e.target.value;
              setLocalIntentPrompt(newPrompt);
              // 实时更新Redux状态 - 同时更新RAG统一状态
              dispatch(setRagIntentAnalysisSettings({
                intentAnalysisModel: localIntentModel,
                intentAnalysisPrompt: newPrompt
              }));
            }}
            placeholder="请输入自定义意图分析提示词..."
            rows={4}
            className="prompt-textarea"
          />
          <div className="prompt-actions">
            <button
              type="button"
              onClick={handleResetPrompt}
              className="reset-prompt-button"
              title="重置为默认提示词"
            >
              重置
            </button>
          </div>
        </div>
        <div className="setting-description">
          自定义意图分析模型的提示词。留空将使用默认提示词。
        </div>
      </div>
    </div>
  );
});

export default IntentAnalysisSettings;