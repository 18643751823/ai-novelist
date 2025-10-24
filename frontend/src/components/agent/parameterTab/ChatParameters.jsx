import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  setContextLimitSettings,
  setAiParametersForMode
} from '../../../store/slices/chatSlice';
import SliderComponent from '../common/SliderComponent';
import SettingGroup from '../common/SettingGroup';
import './ChatParameters.css';

/**
 * 高级设置组件 - 合并AI参数和上下文限制设置
 * 统一管理temperature、top_p、n等参数和上下文限制
 */
const AdvancedSettings = ({
  aiParameters = {},
  onParametersChange,
  mode = 'general'
}) => {
  const dispatch = useDispatch();
  const contextLimitSettings = useSelector(state => state.chat.contextLimitSettings);
  
  // 本地状态管理
  const [localParameters, setLocalParameters] = useState({});
  const [localContextSettings, setLocalContextSettings] = useState({});

  // 初始化AI参数
  useEffect(() => {
    console.log(`[AdvancedSettings] 初始化模式 ${mode} 的参数:`, aiParameters);
    
    let modeParameters;
    if (aiParameters && aiParameters[mode]) {
      modeParameters = aiParameters[mode];
    } else {
      modeParameters = {
        temperature: 0.7,
        top_p: 0.7,
        n: 1
      };
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
      setLocalContextSettings(defaultSettings[mode] || { 
        chatContext: { type: 'turns', value: 10 }, 
        ragContext: { type: 'turns', value: 5 } 
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

        const result = await invoke('set-context-limit-settings', updatedSettings);
        
        if (result.success) {
          dispatch(setContextLimitSettings(updatedSettings));
        }
      }
    } catch (error) {
      console.error('[AdvancedSettings] 自动保存时出错:', error);
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

  // 获取显示文本
  const getDisplayText = (config) => {
    if (!config) return '10轮';
    if (config.type === 'tokens' && config.value === 'full') {
      return '满tokens';
    }
    return `${config.value}轮`;
  };

  // 更新滑动条进度样式
  useEffect(() => {
    const updateSliderProgress = () => {
      const sliders = document.querySelectorAll('.parameter-slider, .context-slider');
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
    const sliders = document.querySelectorAll('.parameter-slider, .context-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', updateSliderProgress);
    });

    return () => {
      sliders.forEach(slider => {
        slider.removeEventListener('input', updateSliderProgress);
      });
    };
  }, [localParameters, localContextSettings]);

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
        <SliderComponent
          label="对话上下文"
          value={localContextSettings.chatContext?.type === 'tokens' ? 51 : localContextSettings.chatContext?.value || 10}
          min={0}
          max={51}
          step={1}
          onChange={(value) => handleContextSettingChange('chatContext', value)}
          description="附加给AI的对话上下文轮数 (1-50轮) 或 满tokens"
          valueFormatter={(value) => value === 51 ? '满tokens' : `${value}轮`}
          type="context"
        />

        <SliderComponent
          label="RAG上下文"
          value={localContextSettings.ragContext?.type === 'tokens' ? 51 : localContextSettings.ragContext?.value || 5}
          min={0}
          max={51}
          step={1}
          onChange={(value) => handleContextSettingChange('ragContext', value)}
          description="附加给RAG检索的上下文轮数 (1-50轮) 或 满tokens"
          valueFormatter={(value) => value === 51 ? '满tokens' : `${value}轮`}
          type="context"
        />
      </SettingGroup>
    </div>
  );
};

export default AdvancedSettings;