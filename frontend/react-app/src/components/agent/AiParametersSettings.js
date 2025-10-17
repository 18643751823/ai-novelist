import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setContextLimitSettings } from '../../store/slices/chatSlice';
import './AiParametersSettings.css';

/**
 * AI参数设置组件
 * 允许用户调整temperature、top_p、n等参数和上下文限制设置
 * 支持按模式管理参数
 */
const AiParametersSettings = ({
  aiParameters = {},
  onParametersChange,
  isSaving = false,
  mode = 'general' // 新增：支持按模式管理
}) => {
  const dispatch = useDispatch();
  const contextLimitSettings = useSelector(state => state.chat.contextLimitSettings);
  const [localContextSettings, setLocalContextSettings] = useState({});
  const [localParameters, setLocalParameters] = useState({});

  // 初始化本地参数
  useEffect(() => {
    console.log(`[DEBUG][AiParametersSettings] 初始化模式 ${mode} 的参数:`, aiParameters);
    // 获取当前模式的参数，如果没有则使用默认值
    let modeParameters;
    
    if (aiParameters && aiParameters[mode]) {
      // 如果该模式有存储的参数，使用存储的参数
      modeParameters = aiParameters[mode];
    } else {
      // 如果没有存储的参数，使用默认值
      modeParameters = {
        temperature: 0.7,
        top_p: 0.7,
        n: 1
      };
      console.log(`[DEBUG][AiParametersSettings] 模式 ${mode} 没有存储的参数，使用默认值`);
    }
    
    setLocalParameters(modeParameters);
  }, [aiParameters, mode]);

  // 初始化上下文限制设置
  useEffect(() => {
    if (contextLimitSettings?.modes?.[mode]) {
      setLocalContextSettings(contextLimitSettings.modes[mode]);
    } else {
      // 默认设置
      const defaultSettings = {
        general: { chatContext: { type: 'turns', value: 10 }, ragContext: { type: 'turns', value: 5 } },
        outline: { chatContext: { type: 'turns', value: 15 }, ragContext: { type: 'turns', value: 5 } },
        writing: { chatContext: { type: 'turns', value: 10 }, ragContext: { type: 'turns', value: 5 } },
        adjustment: { chatContext: { type: 'turns', value: 5 }, ragContext: { type: 'turns', value: 5 } }
      };
      setLocalContextSettings(defaultSettings[mode] || { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 10 } });
    }
  }, [contextLimitSettings, mode]);

  // 处理参数变化
  const handleParameterChange = (parameter, value) => {
    const newParameters = {
      ...localParameters,
      [parameter]: value
    };
    setLocalParameters(newParameters);
    
    // 通知父组件参数已变化，传递模式和参数
    if (onParametersChange) {
      onParametersChange(mode, newParameters);
    }
  };

  // 处理上下文限制设置变化
  const handleContextSettingChange = async (contextType, value) => {
    const newSettings = { ...localContextSettings };
    
    if (value === 51) {
      // 满tokens选项
      newSettings[contextType] = { type: 'tokens', value: 'full' };
    } else {
      // 轮数选项
      newSettings[contextType] = { type: 'turns', value };
    }
    
    setLocalContextSettings(newSettings);
    
    // 自动保存设置
    try {
      const invoke = window.api?.invoke || window.ipcRenderer?.invoke;
      if (invoke) {
        console.log('[AiParametersSettings] 上下文设置变化，自动保存设置');
        
        // 获取当前所有设置，确保包含所有模式
        const currentSettings = contextLimitSettings || {
          modes: {
            general: { chatContext: { type: 'turns', value: 10 }, ragContext: { type: 'turns', value: 5 } },
            outline: { chatContext: { type: 'turns', value: 15 }, ragContext: { type: 'turns', value: 5 } },
            writing: { chatContext: { type: 'turns', value: 10 }, ragContext: { type: 'turns', value: 5 } },
            adjustment: { chatContext: { type: 'turns', value: 5 }, ragContext: { type: 'turns', value: 5 } }
          }
        };
        
        const updatedSettings = {
          modes: {
            ...currentSettings.modes,
            [mode]: newSettings
          }
        };

        console.log('[AiParametersSettings] 自动保存上下文设置:', updatedSettings);
        const result = await invoke('set-context-limit-settings', updatedSettings);
        
        if (result.success) {
          console.log('[AiParametersSettings] 自动保存成功');
          dispatch(setContextLimitSettings(updatedSettings));
        } else {
          console.error('[AiParametersSettings] 自动保存失败:', result.error);
        }
      }
    } catch (error) {
      console.error('[AiParametersSettings] 自动保存时出错:', error);
    }
  };

  // 获取显示文本
  const getDisplayText = (config) => {
    if (!config) return '10轮';
    if (config.type === 'tokens' && config.value === 'full') {
      return '满tokens';
    }
    return `${config.value}轮`;
  };

  // 保存参数设置 - 现在由父组件统一处理保存
  const handleSave = () => {
    console.log(`[AiParametersSettings] 请求保存模式 ${mode} 的AI参数设置:`, localParameters);
    
    // 通知父组件参数已变化，由父组件统一保存
    if (onParametersChange) {
      onParametersChange(mode, localParameters);
    }
  };

  // 重置参数为默认值
  const handleReset = () => {
    const defaultParameters = {
      temperature: 0.7,
      top_p: 0.7,
      n: 1
    };
    
    setLocalParameters(defaultParameters);
    
    // 通知父组件参数已重置
    if (onParametersChange) {
      onParametersChange(mode, defaultParameters);
    }
    
    console.log(`[AiParametersSettings] 重置模式 ${mode} 的AI参数为默认值`);
  };

  // 更新滑动条进度样式
  useEffect(() => {
    const updateSliderProgress = () => {
      const sliders = document.querySelectorAll('.parameter-slider');
      sliders.forEach(slider => {
        const value = parseFloat(slider.value);
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const progress = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
      });
    };

    // 初始更新
    updateSliderProgress();

    // 监听滑动条变化
    const sliders = document.querySelectorAll('.parameter-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', updateSliderProgress);
    });

    return () => {
      sliders.forEach(slider => {
        slider.removeEventListener('input', updateSliderProgress);
      });
    };
  }, [localParameters]);

  // 更新上下文滑动条进度样式
  useEffect(() => {
    const updateContextSliderProgress = () => {
      const sliders = document.querySelectorAll('.context-slider');
      sliders.forEach(slider => {
        const value = parseInt(slider.value);
        const max = parseInt(slider.max);
        const progress = (value / max) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
      });
    };

    // 初始更新
    updateContextSliderProgress();

    // 监听滑动条变化
    const sliders = document.querySelectorAll('.context-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', updateContextSliderProgress);
    });

    return () => {
      sliders.forEach(slider => {
        slider.removeEventListener('input', updateContextSliderProgress);
      });
    };
  }, [localContextSettings]);

  return (
    <div className="ai-parameters-settings">
      <h4>对话参数设置:</h4>
      
      <div className="parameter-group">
        <label>Temperature (温度):</label>
        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={localParameters.temperature ?? 0.7}
            onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
            className="parameter-slider"
          />
          <span className="slider-value">
            {localParameters.temperature ?? 0.7}
          </span>
        </div>
        <div className="parameter-description">
          控制输出的随机性 (0-2)，值越高输出越随机
        </div>
      </div>

      <div className="parameter-group">
        <label>Top P (核采样):</label>
        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={localParameters.top_p ?? 0.7}
            onChange={(e) => handleParameterChange('top_p', parseFloat(e.target.value))}
            className="parameter-slider"
          />
          <span className="slider-value">
            {localParameters.top_p ?? 0.7}
          </span>
        </div>
        <div className="parameter-description">
          控制词汇选择的概率分布 (0-1)，值越小输出越集中
        </div>
      </div>

      <div className="parameter-group">
        <label>N (生成数量):</label>
        <div className="slider-container">
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={localParameters.n ?? 1}
            onChange={(e) => handleParameterChange('n', parseInt(e.target.value))}
            className="parameter-slider"
          />
          <span className="slider-value">
            {localParameters.n ?? 1}
          </span>
        </div>
        <div className="parameter-description">
          每次生成多少个候选响应 (1-5)
        </div>
      </div>


      <div className="parameter-actions">
        <button
          className="save-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          应用设置
        </button>
        <button
          className="reset-button"
          onClick={handleReset}
        >
          重置默认值
        </button>
      </div>

      {/* 上下文限制设置 */}
      <div className="context-settings-section">
        <h4>上下文限制设置:</h4>
        
        <div className="setting-group">
          <label>对话上下文:</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="51"
              value={localContextSettings.chatContext?.type === 'tokens' ? 51 : localContextSettings.chatContext?.value || 10}
              onChange={(e) => handleContextSettingChange('chatContext', parseInt(e.target.value))}
              className="context-slider"
            />
            <span className="slider-value">
              {getDisplayText(localContextSettings.chatContext)}
            </span>
          </div>
          <div className="slider-description">
            附加给AI的对话上下文轮数 (1-50轮) 或 满tokens
          </div>
        </div>

        <div className="setting-group">
          <label>RAG上下文:</label>
          <div className="slider-container">
            <input
              type="range"
              min="0"
              max="51"
              value={localContextSettings.ragContext?.type === 'tokens' ? 51 : localContextSettings.ragContext?.value || 5}
              onChange={(e) => handleContextSettingChange('ragContext', parseInt(e.target.value))}
              className="context-slider"
            />
            <span className="slider-value">
              {getDisplayText(localContextSettings.ragContext)}
            </span>
          </div>
          <div className="slider-description">
            附加给RAG检索的上下文轮数 (1-50轮) 或 满tokens
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiParametersSettings;