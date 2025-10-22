import { useCallback, useEffect, useRef } from 'react';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import { updateTabContent } from '../../../store/slices/novelSlice';

/**
 * 自动保存服务 Hook
 * 处理自动保存逻辑、保存退出请求和保存状态管理
 */
export const useAutoSave = (activeTab, dispatch, isSaving, setIsSaving, setLastSavedTime, setModalMessage, setShowModal) => {
  const { invoke } = useIpcRenderer();
  const autoSaveTimerRef = useRef(null);
  const pendingSaveRef = useRef(false);

  // 自动保存文件内容的函数
  const saveContent = useCallback(
    async (isManualSave = false) => {
      if (!activeTab || !activeTab.isDirty) {
        console.log('[AutoSave] 无需保存：没有激活的标签页或内容未修改。');
        return { success: true };
      }

      const { id: filePath, content } = activeTab;

      console.log('[AutoSave] 尝试保存文件，filePath:', filePath);

      if (!filePath) {
        console.warn('无法保存文件：文件路径无效。', filePath);
        return { success: false, error: '文件路径无效。' };
      }

      // 防止重复保存
      if (isSaving) {
        console.log('[AutoSave] 正在保存中，跳过重复请求');
        return { success: true };
      }

      setIsSaving(true);

      try {
        const result = await invoke('save-novel-content', filePath, content);
        if (!result.success) {
          console.error('文件保存失败:', result.error);
          if (isManualSave) {
            setModalMessage(`文件保存失败: ${result.error}`);
            setShowModal(true);
          }
          return { success: false, error: result.error };
        } else {
          console.log('[AutoSave] 文件保存成功！');
          // 保存成功后，更新状态
          dispatch(updateTabContent({ tabId: filePath, content, isDirty: false }));
          setLastSavedTime(new Date());
          if (window.electron) {
            window.electron.setUnsavedChanges(false);
          }
          if (isManualSave) {
            setModalMessage('文件保存成功！');
            setShowModal(true);
          }
          return { success: true };
        }
      } catch (error) {
        console.error('保存过程中发生异常:', error);
        if (isManualSave) {
           setModalMessage(`保存过程中发生异常: ${error.message}`);
           setShowModal(true);
        }
        return { success: false, error: error.message };
      } finally {
        setIsSaving(false);
        pendingSaveRef.current = false;
      }
    },
    [invoke, activeTab, dispatch, isSaving]
  );

  // 使用 useRef 存储 saveContent 的最新引用
  const saveContentRef = useRef(saveContent);
  useEffect(() => {
    saveContentRef.current = saveContent;
  }, [saveContent]);

  // 自动保存定时器
  useEffect(() => {
    if (!activeTab || !activeTab.isDirty) {
      return;
    }

    // 清除之前的定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 设置新的自动保存定时器（3秒后保存）
    autoSaveTimerRef.current = setTimeout(() => {
      if (activeTab && activeTab.isDirty && !isSaving) {
        console.log('[AutoSave] 触发自动保存');
        saveContentRef.current(false);
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [activeTab?.id, activeTab?.isDirty, isSaving]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // 使用标准IPC监听保存并退出请求
  useEffect(() => {
    // 确保 window.api 在这里被正确识别和使用
    if (!window.api || typeof window.api.on !== 'function' || typeof window.api.send !== 'function') {
      console.warn('window.api 未完全初始化或其方法不可用，无法注册保存退出请求监听器');
      return;
    }

    let isProcessingSaveAndQuit = false; // 添加标志

    const handler = async () => {
      if (isProcessingSaveAndQuit) {
        console.warn('[EditorPanel] save-and-quit-request 已在处理中，跳过重复请求。');
        return;
      }
      isProcessingSaveAndQuit = true;

      console.log('[EditorPanel] 收到主进程的 save-and-quit-request 请求。');
      
      let saveResult;
      try {
        saveResult = await saveContentRef.current(false); // 传入 false 表示非手动保存
      } catch (error) {
        console.error('[EditorPanel] saveContent 调用失败:', error);
        saveResult = { success: false, error: error.message };
      } finally {
        // 无论成功失败，都发送响应
        if (window.api && window.api.send) {
          window.api.send('save-and-quit-response', saveResult);
        } else {
          console.error('window.api.send 不可用，无法发送保存响应。');
        }
        isProcessingSaveAndQuit = false; // 处理完成后重置标志
      }
    };

    // 监听 save-and-quit-request 事件，此 useEffect 依赖项为空，确保只注册一次
    window.api.on('save-and-quit-request', handler);

    return () => {
      // 在组件卸载时移除监听器
      if (window.api && typeof window.api.removeListener === 'function') {
        window.api.removeListener('save-and-quit-request', handler);
      }
    };
  }, []); // 依赖项为空数组，确保只注册一次

  return {
    saveContent,
    saveContentRef
  };
};