import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setContextLimitSettings } from '../../store/slices/chatSlice';
import './ModeContextSettings.css';

/**
 * 单个模式的上下文设置组件
 * 允许用户设置当前模式的对话上下文限制
 */
const ModeContextSettings = ({ mode, modeName }) => {
  const dispatch = useDispatch();
  const contextLimitSettings = useSelector(state => state.chat.contextLimitSettings);
  const [localSettings, setLocalSettings] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // 初始化本地设置
  useEffect(() => {
    if (contextLimitSettings?.modes?.[mode]) {
      setLocalSettings(contextLimitSettings.modes[mode]);
    } else {
      // 默认设置
      const defaultSettings = {
        general: { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 10 } },
        outline: { chatContext: { type: 'turns', value: 30 }, ragContext: { type: 'turns', value: 15 } },
        writing: { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 15 } },
        adjustment: { chatContext: { type: 'turns', value: 15 }, ragContext: { type: 'turns', value: 8 } }
      };
      setLocalSettings(defaultSettings[mode] || { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 10 } });
    }
  }, [contextLimitSettings, mode]);

  // 更新滑动条进度样式
  useEffect(() => {
    const updateSliderProgress = () => {
      const sliders = document.querySelectorAll('.context-slider');
      sliders.forEach(slider => {
        const value = slider.value;
        const max = slider.max;
        const progress = (value / max) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
      });
    };

    // 初始更新
    updateSliderProgress();

    // 监听滑动条变化
    const sliders = document.querySelectorAll('.context-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', updateSliderProgress);
    });

    return () => {
      sliders.forEach(slider => {
        slider.removeEventListener('input', updateSliderProgress);
      });
    };
  }, [localSettings]);

  // 处理滑动条变化
  const handleSliderChange = async (contextType, value) => {
    const newSettings = { ...localSettings };
    
    if (value === 51) {
      // 满tokens选项
      newSettings[contextType] = { type: 'tokens', value: 'full' };
    } else {
      // 轮数选项
      newSettings[contextType] = { type: 'turns', value };
    }
    
    setLocalSettings(newSettings);
    
    // 自动保存设置
    try {
      const invoke = window.api?.invoke || window.ipcRenderer?.invoke;
      if (invoke) {
        console.log('[ModeContextSettings] 滑动条变化，自动保存设置');
        
        // 获取当前所有设置，确保包含所有模式
        const currentSettings = contextLimitSettings || {
          modes: {
            general: { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 10 } },
            outline: { chatContext: { type: 'turns', value: 30 }, ragContext: { type: 'turns', value: 15 } },
            writing: { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 15 } },
            adjustment: { chatContext: { type: 'turns', value: 15 }, ragContext: { type: 'turns', value: 8 } }
          }
        };
        
        const updatedSettings = {
          modes: {
            ...currentSettings.modes,
            [mode]: newSettings
          }
        };

        console.log('[ModeContextSettings] 自动保存设置:', updatedSettings);
        const result = await invoke('set-context-limit-settings', updatedSettings);
        
        if (result.success) {
          console.log('[ModeContextSettings] 自动保存成功');
          dispatch(setContextLimitSettings(updatedSettings));
        } else {
          console.error('[ModeContextSettings] 自动保存失败:', result.error);
        }
      }
    } catch (error) {
      console.error('[ModeContextSettings] 自动保存时出错:', error);
    }
  };

  // 保存设置
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const invoke = window.api?.invoke || window.ipcRenderer?.invoke;
      if (invoke) {
        console.log('[ModeContextSettings] 开始保存上下文设置');
        console.log('[ModeContextSettings] 当前模式:', mode);
        console.log('[ModeContextSettings] 本地设置:', localSettings);
        
        // 获取当前所有设置，确保包含所有模式
        const currentSettings = contextLimitSettings || {
          modes: {
            general: { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 10 } },
            outline: { chatContext: { type: 'turns', value: 30 }, ragContext: { type: 'turns', value: 15 } },
            writing: { chatContext: { type: 'turns', value: 20 }, ragContext: { type: 'turns', value: 15 } },
            adjustment: { chatContext: { type: 'turns', value: 15 }, ragContext: { type: 'turns', value: 8 } }
          }
        };
        
        console.log('[ModeContextSettings] 当前所有设置:', currentSettings);
        
        const updatedSettings = {
          modes: {
            ...currentSettings.modes,
            [mode]: localSettings
          }
        };

        console.log('[ModeContextSettings] 更新后的设置:', updatedSettings);
        console.log('[ModeContextSettings] 调用set-context-limit-settings API');

        const result = await invoke('set-context-limit-settings', updatedSettings);
        
        console.log('[ModeContextSettings] API调用结果:', result);
        
        if (result.success) {
          console.log('[ModeContextSettings] 保存成功，更新Redux状态');
          dispatch(setContextLimitSettings(updatedSettings));
        } else {
          console.error('[ModeContextSettings] 保存上下文设置失败:', result.error);
        }
      } else {
        console.error('[ModeContextSettings] IPC invoke方法不可用');
      }
    } catch (error) {
      console.error('[ModeContextSettings] 保存上下文设置时出错:', error);
      console.error('[ModeContextSettings] 错误详情:', error.message, error.stack);
    } finally {
      setIsSaving(false);
    }
  };

  // 获取显示文本
  const getDisplayText = (config) => {
    if (!config) return '20轮';
    if (config.type === 'tokens' && config.value === 'full') {
      return '满tokens';
    }
    return `${config.value}轮`;
  };

  const chatConfig = localSettings.chatContext || { type: 'turns', value: 20 };
  const ragConfig = localSettings.ragContext || { type: 'turns', value: 10 };

  return (
    <div className="mode-context-settings">
      <h4>上下文限制设置:</h4>
      
      <div className="setting-group">
        <label>对话上下文:</label>
        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="51"
            value={chatConfig.type === 'tokens' ? 51 : chatConfig.value}
            onChange={(e) => handleSliderChange('chatContext', parseInt(e.target.value))}
            className="context-slider"
          />
          <span className="slider-value">
            {getDisplayText(chatConfig)}
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
            value={ragConfig.type === 'tokens' ? 51 : ragConfig.value}
            onChange={(e) => handleSliderChange('ragContext', parseInt(e.target.value))}
            className="context-slider"
          />
          <span className="slider-value">
            {getDisplayText(ragConfig)}
          </span>
        </div>
        <div className="slider-description">
          附加给RAG检索的上下文轮数 (1-50轮) 或 满tokens
        </div>
      </div>

    </div>
  );
};

export default ModeContextSettings;