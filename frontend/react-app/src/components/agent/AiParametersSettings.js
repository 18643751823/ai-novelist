import React, { useState, useEffect } from 'react';
import './AiParametersSettings.css';

/**
 * AI参数设置组件
 * 允许用户调整temperature、top_p、n等参数
 * 支持按模式管理参数
 */
const AiParametersSettings = ({
  aiParameters = {},
  onParametersChange,
  isSaving = false,
  mode = 'general' // 新增：支持按模式管理
}) => {
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

  return (
    <div className="ai-parameters-settings">
      <h4>AI参数设置:</h4>
      
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
    </div>
  );
};

export default AiParametersSettings;