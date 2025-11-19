import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './App.css';
import LayoutComponent from './components/LayoutComponent';
import EditorPanel from './components/editor/EditorPanel';
import ChatPanel from './components/chat/ChatPanel';
import ChapterTreePanel from './components/chapter/ChapterTreePanel';
import { registerWebSocketListeners } from './services/websocketListener'; // 导入新的 WebSocket 处理模块
import websocketClient from './services/websocketClient'; // 导入 WebSocket 客户端
import { setNovelContent, setCurrentFile, triggerChapterRefresh } from './store/slices/novelSlice';
import useHttpService from './hooks/useHttpService';
import {
  setDeepseekApiKey,
  setOpenrouterApiKey,
  setAliyunEmbeddingApiKey,
  setCustomProviders
} from './store/slices/apiSlice';
import { setEnableStream } from './store/slices/toolSlice';
import {
  setCustomPromptForMode,
  setAdditionalInfoForMode,
  setAiParametersForMode,
  setContextLimitSettings
} from './store/slices/modeSlice';

function App() {
  const dispatch = useDispatch();
  const { openTabs, activeTabId } = useSelector((state) => state.novel);

  const { getStoreValue, invoke } = useHttpService();

  // 添加快捷键监听器
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+S 保存编辑器内容
      if (event.ctrlKey && event.key === 's') {
        event.preventDefault(); // 阻止浏览器默认保存行为
        
        // 获取当前活动标签页
        const activeTab = openTabs.find(tab => tab.id === activeTabId);
        
        if (activeTab && activeTab.isDirty) {
          console.log('[App] Ctrl+S pressed - 保存编辑器内容:', activeTab.title);
          
          // 使用HTTP服务保存文件
          console.log('[App] 使用HTTP服务保存文件');
          invoke('save-novel-content', activeTab.id, activeTab.content)
            .then(result => {
              if (result.success) {
                console.log('[App] 文件保存成功');
                // 更新标签页状态为已保存
                dispatch({
                  type: 'novel/updateTabContent',
                  payload: {
                    tabId: activeTab.id,
                    content: activeTab.content,
                    isDirty: false
                  }
                });
              } else {
                console.error('[App] 文件保存失败:', result.error);
              }
            })
            .catch(error => {
              console.error('[App] 保存文件时发生错误:', error);
            });
        } else {
          console.log('[App] Ctrl+S pressed - 没有需要保存的内容');
        }
      }
      
      // Ctrl+Shift+I 或 F12 切换开发者工具
      if ((event.ctrlKey && event.shiftKey && event.key === 'I') || event.key === 'F12') {
        event.preventDefault();
        // 开发者工具功能在浏览器环境中不可用
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openTabs, activeTabId, invoke, dispatch]);

  useEffect(() => {
    const cleanupListeners = registerWebSocketListeners(dispatch); // 注册 WebSocket 监听器

    // 启动 WebSocket 连接
    console.log('[App] 启动 WebSocket 连接');
    websocketClient.connect();

    // 项目启动时加载所有设置
    const loadAppSettings = async () => {
      try {
        console.log('[App] 开始从存储加载设置...');
        const results = await Promise.all([
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
          getStoreValue('aiParameters'),
          getStoreValue('customProviders')
        ]);

        // 提取实际的值
        // 提取实际的值（getStoreValue现在直接返回值，不再返回嵌套对象）
        const storedCustomPrompts = results[0] !== null && results[0] !== undefined ? results[0] : null;
        const storedModeFeatureSettings = results[1] !== null && results[1] !== undefined ? results[1] : null;
        const storedAdditionalInfo = results[2] !== null && results[2] !== undefined ? results[2] : null;
        const storedSelectedModel = results[3] !== null && results[3] !== undefined ? results[3] : null;
        const storedSelectedProvider = results[4] !== null && results[4] !== undefined ? results[4] : null;
        const storedDeepseekApiKey = results[5] !== null && results[5] !== undefined ? results[5] : null;
        const storedOpenrouterApiKey = results[6] !== null && results[6] !== undefined ? results[6] : null;
        const storedAliyunEmbeddingApiKey = results[7] !== null && results[7] !== undefined ? results[7] : null;
        const storedIntentAnalysisModel = results[8] !== null && results[8] !== undefined ? results[8] : null;
        const storedEnableStream = results[9] !== null && results[9] !== undefined ? results[9] : null;
        const storedContextLimitSettings = results[10] !== null && results[10] !== undefined ? results[10] : null;
        const storedAiParameters = results[11] !== null && results[11] !== undefined ? results[11] : null;
        const storedCustomProviders = results[12] !== null && results[12] !== undefined ? results[12] : null;
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
        
        // 注意：setModeFeatureSetting 和 setRagTableNames 不再可用
        // 如果需要这些功能，需要在 modeSlice 中添加相应的 actions
        
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
        console.log(`[App] 从存储加载的selectedModel: "${storedSelectedModel}"`);
        console.log(`[App] 从存储加载的selectedProvider: "${storedSelectedProvider}"`);
        // 注意：setSelectedModel 和 setSelectedProvider 已废弃，不再分发
        if (storedDeepseekApiKey) dispatch(setDeepseekApiKey(storedDeepseekApiKey));
        if (storedOpenrouterApiKey) dispatch(setOpenrouterApiKey(storedOpenrouterApiKey));
        if (storedAliyunEmbeddingApiKey) dispatch(setAliyunEmbeddingApiKey(storedAliyunEmbeddingApiKey));
        if (storedEnableStream !== undefined) dispatch(setEnableStream(storedEnableStream !== false));
        
        // 加载上下文限制设置
        if (storedContextLimitSettings) {
          dispatch(setContextLimitSettings(storedContextLimitSettings));
          console.log('[App] 上下文限制设置已加载:', storedContextLimitSettings);
        } else {
          console.log('[App] 未找到保存的上下文限制设置，使用默认值');
        }

        // 加载自定义提供商数据
        if (storedCustomProviders) {
          dispatch(setCustomProviders(storedCustomProviders));
          console.log('[App] 加载自定义提供商:', storedCustomProviders.length, '个');
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
