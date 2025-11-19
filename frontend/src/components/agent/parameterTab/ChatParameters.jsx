import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setContextLimitSettings,
  setAiParametersForMode
} from '../../../store/slices/chatSlice';
import SliderComponent from '../common/SliderComponent';
import InputComponent from '../common/InputComponent';
import SettingGroup from '../common/SettingGroup';
import './ChatParameters.css';

/**
 * 高级设置组件 - 合并AI参数和上下文限制设置
 * 统一管理temperature、top_p、n等参数和上下文限制
 */
const AdvancedSettings = ({
  aiParameters = {},
  onParametersChange,
  mode = 'outline'
}) => {
  const dispatch = useDispatch();
  const contextLimitSettings = useSelector(state => state.chat.mode.contextLimitSettings);
  
  // 本地状态管理
  const [localParameters, setLocalParameters] = useState({});
  const [localContextSettings, setLocalContextSettings] = useState({});

  // 初始化AI参数
  useEffect(() => {
    console.log(`[AdvancedSettings] 初始化模式 ${mode} 的参数:`, aiParameters);
    
    let modeParameters;
    if (aiParameters && aiParameters[mode]) {
      modeParameters = aiParameters[mode];
      console.log(`[AdvancedSettings] 模式 ${mode} 的详细参数:`, modeParameters);
    } else {
      modeParameters = {
        temperature: 0.7,
        top_p: 0.7,
        n: 1
      };
    }
    
    setLocalParameters(modeParameters);
    
    // 同时初始化上下文限制设置
    if (modeParameters.max_tokens) {
      console.log(`[AdvancedSettings] 设置max_tokens为: ${modeParameters.max_tokens}`);
      setLocalContextSettings({
        max_tokens: modeParameters.max_tokens
      });
    } else {
      // 如果没有max_tokens，设置默认值4000
      console.log(`[AdvancedSettings] 没有找到max_tokens，使用默认值4000`);
      setLocalContextSettings({
        max_tokens: 4000
      });
    }
  }, [aiParameters, mode]);

  // 初始化上下文限制设置
  useEffect(() => {
    if (contextLimitSettings?.modes?.[mode]) {
      setLocalContextSettings(contextLimitSettings.modes[mode]);
    } else {
      const defaultSettings = {
        outline: { max_tokens: 4000 },
        writing: { max_tokens: 8000 },
        adjustment: { max_tokens: 2000 }
      };
      setLocalContextSettings(defaultSettings[mode] || {
        max_tokens: 4000
      });
    }
  }, [contextLimitSettings, mode]);

  // 处理AI参数变化
  const handleParameterChange = (parameter, value) => {
    const newParameters = {
      ...localParameters,
      [parameter]: value
    };
    setLocalParameters(newParameters);
    
    // 通知父组件参数已变化
    if (onParametersChange) {
      onParametersChange(mode, newParameters);
    }
  };

  // 处理上下文限制设置变化
  const handleMaxTokensChange = (value) => {
    const newSettings = {
      ...localContextSettings,
      max_tokens: value
    };
    
    setLocalContextSettings(newSettings);
    
    // 更新AI参数中的max_tokens
    const newParameters = {
      ...localParameters,
      max_tokens: value
    };
    
    setLocalParameters(newParameters);
    
    // 通知父组件参数已变化
    if (onParametersChange) {
      onParametersChange(mode, newParameters);
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
  };

  // 更新滑动条进度样式（仅用于AI参数滑动条）
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
    <div className="advanced-settings">
      {/* AI参数设置 */}
      <SettingGroup
        title="AI参数设置"
        description="调整AI模型的生成参数，控制输出的随机性和多样性"
      >
        <SliderComponent
          label="Temperature (温度)"
          value={localParameters.temperature ?? 0.7}
          min={0}
          max={2}
          step={0.1}
          onChange={(value) => handleParameterChange('temperature', value)}
          description="控制输出的随机性 (0-2)，值越高输出越随机"
          type="parameter"
        />

        <SliderComponent
          label="Top P (核采样)"
          value={localParameters.top_p ?? 0.7}
          min={0}
          max={1}
          step={0.1}
          onChange={(value) => handleParameterChange('top_p', value)}
          description="控制词汇选择的概率分布 (0-1)，值越小输出越集中"
          type="parameter"
        />

        <SliderComponent
          label="N (生成数量)"
          value={localParameters.n ?? 1}
          min={1}
          max={5}
          step={1}
          onChange={(value) => handleParameterChange('n', value)}
          description="每次生成多少个候选响应 (1-5)"
          type="parameter"
        />

        <div className="parameter-actions">
          <button
            className="reset-button"
            onClick={handleReset}
          >
            重置默认值
          </button>
        </div>
      </SettingGroup>

      {/* 上下文限制设置 */}
      <SettingGroup
        title="上下文限制设置"
        description="控制AI可以访问的对话历史长度，影响模型的理解能力"
      >
        <InputComponent
          label="最大上下文长度"
          value={localParameters.max_tokens || 4000}
          onChange={handleMaxTokensChange}
          description="控制对话历史的最大token数，默认4000 tokens。若要自行配置，请不要超过模型本身最大上下文！"
          type="number"
          placeholder="4000"
          min={1000}
        />
      </SettingGroup>
    </div>
  );
};

export default AdvancedSettings;