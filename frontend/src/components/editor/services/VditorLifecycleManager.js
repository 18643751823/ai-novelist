import { useEffect, useRef } from 'react';

/**
 * Vditor 编辑器生命周期管理 Hook
 * 处理 Vditor 编辑器的创建、销毁和内容同步
 */
export const useVditorLifecycle = (
  activeTab, 
  editorRef, 
  handleEditorChange, 
  calculateCharacterCount, 
  setCharacterCount,
  initialContentRef
) => {
  const VditorEditorInstance = useRef(null);

  // Effect 1: Manages the lifecycle (creation/destruction) of the Vditor instance.
  // It runs ONLY when the tab ID or view mode changes.
  useEffect(() => {
    if (activeTab && activeTab.viewMode === 'edit' && editorRef.current) {
      // If we are in the correct view and an instance doesn't exist, create one.
      if (!VditorEditorInstance.current) {
        console.log(`[Lifecycle] Creating new Vditor instance for tab: ${activeTab.id}`);
        
        // Vditor 编辑器已经通过 VditorEditor 组件创建
        // 这里主要处理实例引用和初始化
        VditorEditorInstance.current = editorRef.current;
        initialContentRef.current = activeTab.content;
        
        // 初始化字符计数
        setCharacterCount(calculateCharacterCount(activeTab.content));
      }
    } else {
      // If we are not in edit mode (e.g., in diff view or no tab is active),
      // ensure the instance reference is cleared.
      if (VditorEditorInstance.current) {
        console.log(`[Lifecycle] Clearing Vditor instance reference for tab: ${activeTab?.id}`);
        VditorEditorInstance.current = null;
      }
    }

    // A cleanup function that runs when the dependencies change, before the effect runs again.
    return () => {
      // Vditor 的销毁由 VditorEditor 组件自己处理
      // 这里只需要清理引用
      if (VditorEditorInstance.current) {
        console.log(`[Lifecycle] Cleanup: Clearing Vditor instance reference.`);
        VditorEditorInstance.current = null;
      }
    };
  }, [activeTab?.id, activeTab?.viewMode]); // Precise dependencies

  // Effect 2: Synchronizes content from Redux to the Vditor editor.
  // It runs ONLY when the content in Redux changes.
  useEffect(() => {
    // Check if an instance exists and if the content in Redux is different from the editor's content.
    if (VditorEditorInstance.current && activeTab) {
      const editorContent = VditorEditorInstance.current.getValue ? 
        VditorEditorInstance.current.getValue() : '';
      
      // This check is crucial. It prevents a loop where user input updates Redux,
      // which then updates the editor, interrupting the user's typing.
      // This now only runs for external changes (like `syncFileContent`).
      if (editorContent !== activeTab.content) {
        console.log(`[Sync] Content in Redux differs. Syncing to Vditor for tab: ${activeTab.id}`);
        if (VditorEditorInstance.current.setValue) {
          VditorEditorInstance.current.setValue(activeTab.content);
        }
        initialContentRef.current = activeTab.content;
        // 更新字符计数
        setCharacterCount(calculateCharacterCount(activeTab.content));
      }
    }
  }, [activeTab?.content, calculateCharacterCount]); // Precise dependency

  return {
    VditorEditorInstance
  };
};