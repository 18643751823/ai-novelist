import { useCallback } from 'react';
import { updateNovelTitle } from '../../../store/slices/novelSlice';

/**
 * 标题管理 Hook
 * 处理标题编辑和保存逻辑
 */
export const useTitleManager = (activeTab, dispatch, title, setTitle, setIsTitleEditing, TiptapEditorInstance) => {
  const handleTitleSave = useCallback(async () => {
    if (!activeTab) return;

    const pureCurrentTitle = activeTab.title;

    if (title && title !== pureCurrentTitle) {
      try {
        await dispatch(updateNovelTitle({ oldFilePath: activeTab.id, newTitle: title })).unwrap();
        console.log('标题保存成功:', title);
      } catch (error) {
        console.error('标题保存失败:', error);
      }
    }
    setIsTitleEditing(false);
  }, [dispatch, title, activeTab?.id, activeTab?.title]); // Depend on specific properties

  const handleTitleKeyDown = useCallback(async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await handleTitleSave();
      if (TiptapEditorInstance.current) {
        TiptapEditorInstance.current.commands.focus('start');
      }
    }
  }, [handleTitleSave, TiptapEditorInstance]);

  const handleTitleFocus = useCallback(() => {
    if (title === '未命名') {
      setTitle('');
    }
  }, [title, setTitle]);

  return {
    handleTitleSave,
    handleTitleKeyDown,
    handleTitleFocus
  };
};