import { useCallback } from 'react';
import useHttpService from '../../../hooks/useHttpService';
import { updateTabContent } from '../../../store/slices/novelSlice';

/**
 * 手动保存服务 Hook
 * 处理手动保存逻辑和保存状态管理
 */
export const useManualSave = (activeTab, dispatch, isSaving, setIsSaving, setLastSavedTime, setModalMessage, setShowModal) => {
  const { invoke } = useHttpService();

  // 手动保存文件内容的函数
  const saveContent = useCallback(
    async (isManualSave = false) => {
      if (!activeTab || !activeTab.isDirty) {
        console.log('[ManualSave] 无需保存：没有激活的标签页或内容未修改。');
        return { success: true };
      }

      const { id: filePath, content } = activeTab;

      console.log('[ManualSave] 尝试保存文件，filePath:', filePath);

      if (!filePath) {
        console.warn('无法保存文件：文件路径无效。', filePath);
        return { success: false, error: '文件路径无效。' };
      }

      // 防止重复保存
      if (isSaving) {
        console.log('[ManualSave] 正在保存中，跳过重复请求');
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
          console.log('[ManualSave] 文件保存成功！');
          // 保存成功后，更新状态
          dispatch(updateTabContent({ tabId: filePath, content, isDirty: false }));
          setLastSavedTime(new Date());
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
      }
    },
    [invoke, activeTab, dispatch, isSaving]
  );

  return {
    saveContent
  };
};
