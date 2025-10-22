import { useEffect, useRef } from 'react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { convertTextToTiptapJson, convertTiptapJsonToText } from '../utils/editorHelpers';

/**
 * 编辑器生命周期管理 Hook
 * 处理 Tiptap 编辑器的创建、销毁和内容同步
 */
export const useEditorLifecycle = (
  activeTab, 
  editorRef, 
  handleEditorChange, 
  updateParagraphs, 
  calculateCharacterCount, 
  setCharacterCount,
  initialContentRef
) => {
  const TiptapEditorInstance = useRef(null);

  // Effect 1: Manages the lifecycle (creation/destruction) of the Tiptap instance.
  // It runs ONLY when the tab ID or view mode changes.
  useEffect(() => {
    if (activeTab && activeTab.viewMode === 'edit' && editorRef.current) {
      // If we are in the correct view and an instance doesn't exist, create one.
      if (!TiptapEditorInstance.current) {
        console.log(`[Lifecycle] Creating new Tiptap instance for tab: ${activeTab.id}`);
        const editor = new Editor({
          element: editorRef.current,
          extensions: [StarterKit.configure()],
          content: convertTextToTiptapJson(activeTab.content),
          onUpdate: handleEditorChange,
        });
        TiptapEditorInstance.current = editor;
        initialContentRef.current = activeTab.content;
        setTimeout(updateParagraphs, 50);
      }
    } else {
      // If we are not in edit mode (e.g., in diff view or no tab is active),
      // or if the editor DOM ref is not available, ensure the instance is destroyed.
      if (TiptapEditorInstance.current) {
        console.log(`[Lifecycle] Destroying Tiptap instance for tab: ${activeTab?.id}`);
        TiptapEditorInstance.current.destroy();
        TiptapEditorInstance.current = null;
      }
    }

    // A cleanup function that runs when the dependencies change, before the effect runs again.
    return () => {
      if (TiptapEditorInstance.current) {
        console.log(`[Lifecycle] Cleanup: Destroying Tiptap instance.`);
        TiptapEditorInstance.current.destroy();
        TiptapEditorInstance.current = null;
      }
    };
  }, [activeTab?.id, activeTab?.viewMode]); // Precise dependencies

  // Effect 2: Synchronizes content from Redux to an EXISTING Tiptap instance.
  // It runs ONLY when the content in Redux changes.
  useEffect(() => {
    // Check if an instance exists and if the content in Redux is different from the editor's content.
    if (TiptapEditorInstance.current && activeTab) {
      const editorContent = convertTiptapJsonToText(TiptapEditorInstance.current.getJSON());
      
      // This check is crucial. It prevents a loop where user input updates Redux,
      // which then updates the editor, interrupting the user's typing.
      // This now only runs for external changes (like `syncFileContent`).
      if (editorContent !== activeTab.content) {
        console.log(`[Sync] Content in Redux differs. Syncing to Tiptap for tab: ${activeTab.id}`);
        const { from, to } = TiptapEditorInstance.current.state.selection;
        TiptapEditorInstance.current.commands.setContent(convertTextToTiptapJson(activeTab.content), false);
        // Attempt to restore selection
        TiptapEditorInstance.current.commands.setTextSelection({ from, to });
        initialContentRef.current = activeTab.content;
        // 更新字符计数
        setCharacterCount(calculateCharacterCount(activeTab.content));
        setTimeout(updateParagraphs, 50);
      }
    }
  }, [activeTab?.content, calculateCharacterCount]); // Precise dependency

  return {
    TiptapEditorInstance
  };
};