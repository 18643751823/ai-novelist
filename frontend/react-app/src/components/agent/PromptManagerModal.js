import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCustomPromptForMode,
  resetCustomPromptForMode,
  setModeFeatureSetting,
  resetModeFeatureSettings,
  setAdditionalInfoForMode,
  setAdditionalInfoFieldForMode,
  resetAdditionalInfoForMode
} from '../../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSave, faUndo, faSlidersH } from '@fortawesome/free-solid-svg-icons';
import './PromptManagerModal.css';
import ModeContextSettings from './ModeContextSettings';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import NotificationModal from '../others/NotificationModal';

const PromptManagerModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const { customPrompts, modeFeatureSettings, additionalInfo } = useSelector((state) => state.chat);
  const { invoke } = useIpcRenderer();
  // 不再使用标签页切换，两个面板同时显示
  const [localPrompts, setLocalPrompts] = useState({
    general: '',
    outline: '',
    writing: '',
    adjustment: ''
  });
  const [localFeatureSettings, setLocalFeatureSettings] = useState({
    general: { ragRetrievalEnabled: false },
    outline: { ragRetrievalEnabled: false },
    writing: { ragRetrievalEnabled: false },
    adjustment: { ragRetrievalEnabled: false }
  });
  const [localAdditionalInfo, setLocalAdditionalInfo] = useState({
    general: {
      outline: '',
      previousChapter: '',
      characterSettings: ''
    },
    outline: {
      outline: '',
      previousChapter: '',
      characterSettings: ''
    },
    writing: {
      outline: '',
      previousChapter: '',
      characterSettings: ''
    },
    adjustment: {
      outline: '',
      previousChapter: '',
      characterSettings: ''
    }
  });
  const [selectedMode, setSelectedMode] = useState('general'); // 用于持久记忆标签页的模式选择
  const [defaultPrompts, setDefaultPrompts] = useState({}); // 从后端获取的默认提示词
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false); // 加载状态
  const [showNotification, setShowNotification] = useState(false); // 通知弹窗显示状态
  const [notificationMessage, setNotificationMessage] = useState(''); // 通知消息
// 从后端获取默认提示词
const fetchDefaultPrompts = async () => {
  setIsLoadingPrompts(true);
  try {
    const result = await invoke('get-default-prompts');
    if (result.success) {
      setDefaultPrompts(result.prompts);
      console.log('成功从后端获取默认提示词:', result.prompts);
    } else {
      console.error('获取默认提示词失败:', result.error);
      // 如果后端获取失败，使用前端默认值作为fallback
      setDefaultPrompts({
        general: `你是一个**工具使用型AI**，精通使用各种工具来完成用户请求。

**你的核心任务是：**
1. **准确理解用户意图。**
2. **根据用户意图，规划需要使用的工具和步骤。**
3. **严格按照工具的 JSON Schema 定义，生成有效的 'tool_calls' 对象。**
  - **极其重要：** 你必须将工具调用生成在响应的 **'tool_calls' 字段**中。
  - **绝对禁止：** **切勿**将工具调用的 JSON 结构以文本形式（例如，Markdown 代码块）输出到 'content' 字段中。系统无法解析 'content' 字段中的工具调用。
  - **只有通过 'tool_calls' 字段生成的工具请求，系统才能识别并执行。**
4. **根据工具执行结果，继续执行任务或进行后续工具调用。**
5. **当所有任务都已完成时，你必须、也只能调用名为 'end_task' 的工具来结束对话。`,

        outline: `你是一位小说创作顾问，负责与用户深度沟通本章核心需求。
先通过多轮对话收集以下信息：
1. 核心情节冲突。
2. 人物行为与动机。
3. 场景与氛围要求。
4. 本章需要注意的伏笔或者暗线。
5. 后一章的大致走向，便于本章结尾的铺垫。

随后生成完整的结构化细纲（含场景序列、关键对话、情绪转折点等等），向用户展示细纲并询问：『是否需调整？请指出修改方向』。

注意，请保持和用户沟通时的礼貌。`,

        writing: `你是一位专业小说代笔，需严格基于用户提供的【最终版细纲】进行创作。核心任务：解析细纲中的场景节点，扩展为2000字左右的正文。文风模仿知识库中的句式结构、高频词汇、描写偏好。重点在于补充各种描写，非必要时禁止添加细纲外新情节。`,

        adjustment: `你是一位资深编辑和小说精修师。你的任务是：
1.  **诊断问题**：根据用户提供的草稿，从剧情逻辑、语言问题（如"AI味"）、风格一致性等方面进行检查。
2.  **提供报告**：输出一份检查报告，每个问题都需提供修改案例，格式为：【原句】、【建议】、【理由】。
3.  **执行修改**：根据用户批准的修改建议，对草稿进行精修，确保修改后的内容逻辑清晰、文风与原文保持一致，并且不得变更用户已确认的核心情节。`
      });
    }
  } catch (error) {
    console.error('调用获取默认提示词API失败:', error);
  } finally {
    setIsLoadingPrompts(false);
  }
};

  useEffect(() => {
    if (isOpen) {
      // 初始化本地状态
      setLocalPrompts(customPrompts);
      setLocalFeatureSettings(modeFeatureSettings);
      
      // 处理附加信息的旧格式迁移
      const migratedAdditionalInfo = {};
      for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
        const modeInfo = additionalInfo[mode];
        if (typeof modeInfo === 'string') {
          // 旧格式：字符串，迁移到新格式
          migratedAdditionalInfo[mode] = {
            outline: modeInfo,
            previousChapter: '',
            characterSettings: ''
          };
          console.log(`[PromptManagerModal] 迁移旧格式附加信息: ${mode}`);
        } else if (typeof modeInfo === 'object' && modeInfo !== null) {
          // 新格式：对象
          migratedAdditionalInfo[mode] = {
            outline: modeInfo.outline || '',
            previousChapter: modeInfo.previousChapter || '',
            characterSettings: modeInfo.characterSettings || ''
          };
        } else {
          // 空数据
          migratedAdditionalInfo[mode] = {
            outline: '',
            previousChapter: '',
            characterSettings: ''
          };
        }
      }
      setLocalAdditionalInfo(migratedAdditionalInfo);
      
      // 从后端获取默认提示词
      fetchDefaultPrompts();
    }
  }, [isOpen, customPrompts, modeFeatureSettings, additionalInfo]);

  const handlePromptChange = (mode, value) => {
    setLocalPrompts(prev => ({
      ...prev,
      [mode]: value
    }));
  };

  const handleFeatureSettingChange = (mode, feature, enabled) => {
    setLocalFeatureSettings(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [feature]: enabled
      }
    }));
  };

  const handleAdditionalInfoChange = (mode, field, value) => {
    setLocalAdditionalInfo(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [field]: value
      }
    }));
  };

  // 应用到全部模式
  const handleApplyToAllModes = () => {
    const currentInfo = localAdditionalInfo[selectedMode];
    for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
      setLocalAdditionalInfo(prev => ({
        ...prev,
        [mode]: { ...currentInfo }
      }));
      // 同时更新Redux状态
      dispatch(setAdditionalInfoForMode({
        mode,
        info: { ...currentInfo }
      }));
    }
    // 显示应用成功弹窗
    setNotificationMessage('应用成功');
    setShowNotification(true);
  };

  const handleSave = async () => {
    console.log('[PromptManagerModal] 开始保存所有设置');
    
    // 保存所有模式的自定义提示词
    for (const mode of Object.keys(localPrompts)) {
      dispatch(setCustomPromptForMode({ mode, prompt: localPrompts[mode] }));
    }
    
    // 保存所有模式的功能设置（只保存RAG检索功能）
    for (const mode of Object.keys(localFeatureSettings)) {
      const settings = localFeatureSettings[mode];
      dispatch(setModeFeatureSetting({ mode, feature: 'ragRetrievalEnabled', enabled: settings.ragRetrievalEnabled }));
    }
    
    // 保存所有模式的附加信息
    for (const mode of Object.keys(localAdditionalInfo)) {
      dispatch(setAdditionalInfoForMode({ mode, info: localAdditionalInfo[mode] }));
    }
    
    // 保存到持久化存储
    // 使用 window.api.invoke 或 window.ipcRenderer.invoke
    const invoke = window.api?.invoke || window.ipcRenderer?.invoke;
    if (invoke) {
      try {
        console.log('[PromptManagerModal] 保存自定义提示词到存储 - 开始:', localPrompts);
        console.log('[PromptManagerModal] localPrompts 类型:', typeof localPrompts);
        console.log('[PromptManagerModal] localPrompts 键:', Object.keys(localPrompts));
        
        // 检查每个模式的内容
        for (const mode in localPrompts) {
          console.log(`[PromptManagerModal] localPrompts[${mode}]:`, localPrompts[mode]);
        }
        
        // 保存提示词
        const promptResult = await invoke('set-store-value', 'customPrompts', localPrompts);
        console.log('[PromptManagerModal] set-store-value 调用结果:', promptResult);
        
        // 保存功能设置
        const featureResult = await invoke('set-store-value', 'modeFeatureSettings', localFeatureSettings);
        console.log('[PromptManagerModal] 功能设置保存结果:', featureResult);
        
        // 保存附加信息
        const additionalInfoResult = await invoke('set-store-value', 'additionalInfo', localAdditionalInfo);
        console.log('[PromptManagerModal] 附加信息保存结果:', additionalInfoResult);
        
        // 保存上下文限制设置（从Redux状态获取）
        // 注意：这里不能使用useSelector，因为它在函数内部
        // 上下文设置应该由ModeContextSettings组件单独保存
        
        // 立即验证保存是否成功
        const savedPrompts = await invoke('get-store-value', 'customPrompts');
        console.log('[PromptManagerModal] 从存储读取的验证值:', savedPrompts);
        console.log('[PromptManagerModal] 验证值类型:', typeof savedPrompts);
        
        const savedFeatures = await invoke('get-store-value', 'modeFeatureSettings');
        console.log('[PromptManagerModal] 从存储读取的功能设置:', savedFeatures);
        
        const savedAdditionalInfo = await invoke('get-store-value', 'additionalInfo');
        console.log('[PromptManagerModal] 从存储读取的附加信息:', savedAdditionalInfo);
        
        const savedContext = await invoke('get-context-limit-settings');
        console.log('[PromptManagerModal] 从存储读取的上下文设置:', savedContext);
        
        if (savedPrompts) {
          console.log('[PromptManagerModal] 验证值键:', Object.keys(savedPrompts));
        }
      } catch (error) {
        console.error('[PromptManagerModal] 保存设置失败:', error);
        console.error('[PromptManagerModal] 错误详情:', error.message, error.stack);
      }
    } else {
      console.error('[PromptManagerModal] 无法访问存储API');
    }
    
    // 显示保存成功通知
    setNotificationMessage('设置已保存');
    setShowNotification(true);
  };

  const handleReset = (mode) => {
    if (defaultPrompts[mode]) {
      setLocalPrompts(prev => ({
        ...prev,
        [mode]: defaultPrompts[mode]
      }));
    }
    // 重置功能设置
    setLocalFeatureSettings(prev => ({
      ...prev,
      [mode]: { ragRetrievalEnabled: mode === 'general' }
    }));
    // 重置附加信息
    setLocalAdditionalInfo(prev => ({
      ...prev,
      [mode]: {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      }
    }));
  };

  const closeNotification = () => {
    setShowNotification(false);
  };

  const getModeDisplayName = (mode) => {
    const names = {
      general: '通用',
      outline: '细纲',
      writing: '写作',
      adjustment: '调整'
    };
    return names[mode] || mode;
  };

  return (
    <div className={`prompt-manager-modal ${isOpen ? 'open' : ''}`}>
      <div className="prompt-manager-modal-content">
        <div className="modal-header">
          <h2>提示词管理器</h2>
          <button className="close-button" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className="tab-navigation">
          {['general', 'outline', 'writing', 'adjustment'].map((mode) => (
            <button
              key={mode}
              className={`tab-button ${selectedMode === mode ? 'active' : ''}`}
              onClick={() => setSelectedMode(mode)}
            >
              {getModeDisplayName(mode)}模式
            </button>
          ))}
        </div>

        <div className="tab-content">
          {/* 自定义提示词 */}
          <div className="custom-prompt">
            <h4>自定义提示词:</h4>
            <textarea
              value={localPrompts[mode] || ''}
              onChange={(e) => handlePromptChange(mode, e.target.value)}
              placeholder={defaultPrompt}
              rows={6}
            />
            <button
              className="reset-button"
              onClick={() => handleReset(mode)}
              disabled={!localPrompts[mode] &&
                       !localFeatureSettings[mode].ragRetrievalEnabled}
            >
              <FontAwesomeIcon icon={faUndo} /> 重置
            </button>
          </div>

          {/* 新增：功能设置 */}
          <div className="feature-settings">
            <h4>功能设置:</h4>
            
            {/* 工具功能状态说明 */}
            {mode === 'general' ? (
              <div className="feature-info">
                <strong>工具功能：始终启用</strong>
                <div className="feature-description">
                  通用模式下AI可以自动使用工具进行文件操作、代码编辑等
                </div>
              </div>
            ) : (
              <div className="feature-info">
                <strong>工具功能：禁用</strong>
                <div className="feature-description">
                  此模式下AI仅提供对话功能，无法使用工具
                </div>
              </div>
            )}


            {/* 单个模式的上下文设置 */}
            <ModeContextSettings mode={mode} modeName={getModeDisplayName(mode)} />
          </div>
        </div>

        <div className="modal-actions">
          <button className="save-button" onClick={handleSave}>
            <FontAwesomeIcon icon={faSave} /> 保存设置
          </button>
          <button className="cancel-button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>

      {/* 通知弹窗 */}
      {showNotification && (
        <NotificationModal
          message={notificationMessage}
          onClose={closeNotification}
        />
      )}
    </div>
  );
};

// 辅助函数：获取模式显示名称
const getModeDisplayName = (mode) => {
  const names = {
    general: '通用',
    outline: '细纲',
    writing: '写作',
    adjustment: '调整'
  };
  return names[mode] || mode;
};

export default PromptManagerModal;