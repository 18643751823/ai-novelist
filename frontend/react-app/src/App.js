import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './App.css';
import LayoutComponent from './components/LayoutComponent';
import EditorPanel from './components/editor/EditorPanel';
import ChatPanel from './components/chat/ChatPanel';
import ChapterTreePanel from './components/chapter/ChapterTreePanel';
import { registerMainIpcListeners } from './ipc/mainIpcHandler'; // 导入新的 IPC 处理模块
import { setNovelContent, setCurrentFile, triggerChapterRefresh } from './store/slices/novelSlice';
import useIpcRenderer from './hooks/useIpcRenderer';
import {
  setCustomPromptForMode,
  setModeFeatureSetting,
  setRagTableNames,
  setAdditionalInfoForMode,
  setSelectedModel,
  setSelectedProvider,
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setAliyunEmbeddingApiKey,
  setIntentAnalysisModel,
  setEnableStream,
  setContextLimitSettings,
  setAiParametersForMode
} from './store/slices/chatSlice';

function App() {
  const dispatch = useDispatch();

  const { getStoreValue } = useIpcRenderer();

  // 添加快捷键监听器
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+Shift+I 或 F12 切换开发者工具
      if ((event.ctrlKey && event.shiftKey && event.key === 'I') || event.key === 'F12') {
        event.preventDefault();
        if (window.electron && window.electron.toggleDevTools) {
          window.electron.toggleDevTools();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const cleanupListeners = registerMainIpcListeners(dispatch); // 注册 IPC 监听器


    // 项目启动时加载所有设置
    const loadAppSettings = async () => {
      try {
        console.log('[App] 开始从存储加载设置...');
        const [
          storedCustomPrompts,
          storedModeFeatureSettings,
          storedAdditionalInfo,
          storedSelectedModel,
          storedSelectedProvider,
          storedDeepseekApiKey,
          storedOpenrouterApiKey,
          storedAliyunEmbeddingApiKey,
          storedIntentAnalysisModel,
          storedEnableStream,
          storedContextLimitSettings,
          storedAiParameters
        ] = await Promise.all([
          getStoreValue('customPrompts'),
          getStoreValue('modeFeatureSettings'),
          getStoreValue('additionalInfo'),
          getStoreValue('selectedModel'),
          getStoreValue('selectedProvider'),
          getStoreValue('deepseekApiKey'),
          getStoreValue('openrouterApiKey'),
          getStoreValue('aliyunEmbeddingApiKey'),
          getStoreValue('intentAnalysisModel'),
          getStoreValue('enableStream'),
          getStoreValue('contextLimitSettings'),
          getStoreValue('aiParameters')
        ]);

        console.log('[App] 从存储获取的设置:');
        console.log('[App] customPrompts:', JSON.stringify(storedCustomPrompts, null, 2));
        console.log('[App] modeFeatureSettings:', JSON.stringify(storedModeFeatureSettings, null, 2));
        console.log('[App] additionalInfo:', JSON.stringify(storedAdditionalInfo, null, 2));
        console.log('[App] aiParameters:', JSON.stringify(storedAiParameters, null, 2));

        // 更新Redux store中的设置
        if (storedCustomPrompts) {
          Object.entries(storedCustomPrompts).forEach(([mode, prompt]) => {
            dispatch(setCustomPromptForMode({ mode, prompt }));
          });
        }
        
        if (storedModeFeatureSettings) {
          Object.entries(storedModeFeatureSettings).forEach(([mode, settings]) => {
            if (settings.ragRetrievalEnabled !== undefined) {
              dispatch(setModeFeatureSetting({ mode, feature: 'ragRetrievalEnabled', enabled: settings.ragRetrievalEnabled }));
            }
            if (settings.ragTableNames !== undefined) {
              dispatch(setRagTableNames({ mode, tableNames: settings.ragTableNames }));
            }
          });
        }
        
        if (storedAdditionalInfo) {
          Object.entries(storedAdditionalInfo).forEach(([mode, info]) => {
            dispatch(setAdditionalInfoForMode({ mode, info }));
          });
        }

        // 加载AI参数设置
        if (storedAiParameters) {
          // 直接使用从存储中获取的aiParameters，跳过有问题的迁移逻辑
          console.log('[App] 从存储加载的原始AI参数:', storedAiParameters);
          
          // 设置各个模式的AI参数（包括自定义模式）
          for (const mode of Object.keys(storedAiParameters)) {
            if (storedAiParameters[mode]) {
              dispatch(setAiParametersForMode({ mode, parameters: storedAiParameters[mode] }));
              console.log(`[App] 为模式 ${mode} 设置AI参数:`, storedAiParameters[mode]);
            }
          }
          console.log('[App] AI参数设置已加载:', storedAiParameters);
        } else {
          console.log('[App] 未找到保存的AI参数设置，使用默认值');
        }

        // 加载其他设置
        if (storedSelectedModel) dispatch(setSelectedModel(storedSelectedModel));
        if (storedSelectedProvider) dispatch(setSelectedProvider(storedSelectedProvider));
        if (storedDeepseekApiKey) dispatch(setDeepseekApiKey(storedDeepseekApiKey));
        if (storedOpenrouterApiKey) dispatch(setOpenrouterApiKey(storedOpenrouterApiKey));
        if (storedAliyunEmbeddingApiKey) dispatch(setAliyunEmbeddingApiKey(storedAliyunEmbeddingApiKey));
        if (storedIntentAnalysisModel) dispatch(setIntentAnalysisModel(storedIntentAnalysisModel));
        if (storedEnableStream !== undefined) dispatch(setEnableStream(storedEnableStream !== false));
        
        // 加载上下文限制设置
        if (storedContextLimitSettings) {
          dispatch(setContextLimitSettings(storedContextLimitSettings));
          console.log('[App] 上下文限制设置已加载:', storedContextLimitSettings);
        } else {
          console.log('[App] 未找到保存的上下文限制设置，使用默认值');
        }

        console.log('[App] 设置加载完成');
      } catch (error) {
        console.error('[App] 加载设置失败:', error);
      }
    };

    loadAppSettings();

    return () => {
      cleanupListeners(); // 清理监听器
    };
  }, [dispatch, getStoreValue]); // 依赖 dispatch 和 getStoreValue

  return (
    <div className="App">
      {/* 自定义标题栏 */}
      <div className="custom-titlebar">
        青烛
      </div>
      {/* 内容区域 */}
      <div className="content-area">
        <LayoutComponent
          chapterPanel={<ChapterTreePanel />}
          editorPanel={<EditorPanel />}
          chatPanel={<ChatPanel />} // ChatPanel 不再需要传递 props，它会通过 useSelector 获取
        />
      </div>
    </div>
  );
}

export default App;
