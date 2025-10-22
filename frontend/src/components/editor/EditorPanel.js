import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateNovelTitle, updateTabContent, startDiff, endDiff } from '../../store/slices/novelSlice';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import DiffViewer from './DiffViewer'; // 引入 DiffViewer
import ContextMenu from '../others/ContextMenu'; // 引入 ContextMenu

import './EditorPanel.css';
import NotificationModal from '../others/NotificationModal.js';
import BackgroundImage from './BackgroundImage'; // 导入新的背景图组件

import useIpcRenderer from '../../hooks/useIpcRenderer';
import { useAutoSave } from './services/AutoSaveService';
import { useEditorLifecycle } from './services/EditorLifecycleManager';
import { useCharacterCount } from './services/CharacterCountService';
import { useTitleManager } from './services/TitleManager';
import { useContextMenu } from './hooks/useContextMenu';
import { getContextMenuItems, handleMenuItemClick, convertTiptapJsonToText, convertTextToTiptapJson } from './utils/editorHelpers';

function EditorPanel({ splitViewTabId = null }) {
  const dispatch = useDispatch();
  const { openTabs, activeTabId, splitView } = useSelector((state) => state.novel);
  
  // 在分屏模式下，使用传入的tabId，否则使用activeTabId
  const displayTabId = splitViewTabId || activeTabId;
  const activeTab = openTabs.find(tab => tab.id === displayTabId);

  const editorRef = useRef(null);
  const titleInputRef = useRef(null);
  const initialContentRef = useRef(activeTab?.content); // 用 activeTab 的内容初始化
  const { invoke } = useIpcRenderer();
  
  // 状态管理
  const [title, setTitle] = useState('未命名');
  const [paragraphs, setParagraphs] = useState([]);
  const lineNumbersRef = useRef(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isTitleEditing, setIsTitleEditing] = useState(false);

  // 使用服务模块
  const { calculateCharacterCount } = useCharacterCount();

  // 定义函数
  const updateParagraphs = useCallback(() => {
    requestAnimationFrame(() => {
      if (editorRef.current) {
        const paragraphNodes = editorRef.current.querySelectorAll('.ProseMirror p');
        const newParagraphs = Array.from(paragraphNodes).map(p => ({
          top: p.offsetTop,
        }));
        setParagraphs(newParagraphs);
      }
    });
  }, []);

  const handleEditorChange = useCallback(({ editor }) => {
    if (!activeTab) return;

    const jsonContent = editor.getJSON();
    const newContent = convertTiptapJsonToText(jsonContent);
    
    // 派发 action 更新 tab 内容和 isDirty 状态
    dispatch(updateTabContent({ tabId: activeTab.id, content: newContent }));

    // 更新字符计数
    setCharacterCount(calculateCharacterCount(newContent));

    const changed = newContent !== initialContentRef.current;
    if (window.electron) {
        window.electron.setUnsavedChanges(changed);
    }

    updateParagraphs();
  }, [dispatch, activeTab?.id, updateParagraphs, calculateCharacterCount]); // 依赖于 activeTab.id 而不是整个对象

  const { saveContent, saveContentRef } = useAutoSave(
    activeTab,
    dispatch,
    isSaving,
    setIsSaving,
    setLastSavedTime,
    setModalMessage,
    setShowModal
  );

  const { TiptapEditorInstance } = useEditorLifecycle(
    activeTab,
    editorRef,
    handleEditorChange,
    updateParagraphs,
    calculateCharacterCount,
    setCharacterCount,
    initialContentRef
  );

  const { handleTitleSave, handleTitleKeyDown, handleTitleFocus } = useTitleManager(
    activeTab,
    dispatch,
    title,
    setTitle,
    setIsTitleEditing,
    TiptapEditorInstance
  );

  const {
    showContextMenu,
    contextMenuPos,
    handleContextMenu,
    handleCloseContextMenu
  } = useContextMenu();

  const handleEditorClick = useCallback((e) => {
    const editor = TiptapEditorInstance.current;
    if (!editor) return;

    const { clientY } = e;
    const editorBounds = editorRef.current.getBoundingClientRect();

    const proseMirrorContent = editorRef.current.querySelector('.ProseMirror');
    if (!proseMirrorContent) return;

    const contentBottom = proseMirrorContent.getBoundingClientRect().bottom;

    if (clientY > contentBottom && clientY < editorBounds.bottom) {
      editor.commands.focus('end');
    }
  }, []);

  // Effect for updating the 'isDirty' status in the main process
  useEffect(() => {
    if (window.electron && activeTab) {
      window.electron.setUnsavedChanges(activeTab.isDirty);
    }
  }, [activeTab?.isDirty]);

  // 初始化字符计数
  useEffect(() => {
    if (activeTab) {
      setTitle(activeTab.title);
      setCharacterCount(calculateCharacterCount(activeTab.content));
    } else {
      setTitle('未命名');
      setCharacterCount(0);
    }
  }, [activeTab?.id, activeTab?.title, activeTab?.content, calculateCharacterCount]); // Depend on specific properties

  // 在分屏模式下，如果当前标签页不在分屏中，则不显示
  const shouldShowInSplitView = splitView.enabled && splitViewTabId === null &&
      displayTabId !== splitView.leftTabId && displayTabId !== splitView.rightTabId;
  
  if (splitView.enabled && shouldShowInSplitView) {
    return null;
  }

  return (
    <>
      {!activeTab ? (
        <div className="no-file-selected-panel">
          <BackgroundImage />
        </div>
      ) : (
        <div className="editor-panel-content">
          <div className="title-bar">
            {activeTab.isDeleted ? (
              <div className="deleted-file-indicator">
                <span className="deleted-icon">🗑️</span>
                <span className="deleted-text">{title} (已删除)</span>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  ref={titleInputRef}
                  className="novel-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onFocus={handleTitleFocus}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                />
                {/* 自动保存状态显示 */}
                <div className="auto-save-status">
                  {isSaving ? (
                    <span className="saving-indicator">保存中...</span>
                  ) : lastSavedTime ? (
                    <span className="saved-indicator">
                      已保存 {lastSavedTime.toLocaleTimeString()}
                    </span>
                  ) : (
                    <span className="unsaved-indicator">未保存</span>
                  )}
                </div>
                {/* 临时的 Diff 触发按钮 */}
                {activeTab.isDirty && <span className="unsaved-indicator">*</span>}
              </>
            )}
          </div>

          {activeTab.isDeleted ? (
            <div className="deleted-file-message">
              <p>此文件已被删除，无法编辑。</p>
              <p>请关闭此标签页或切换到其他文件。</p>
            </div>
          ) : activeTab.viewMode === 'diff' ? (
            <div className="diff-view-wrapper">
              <DiffViewer
                originalContent={activeTab.content}
                currentContent={activeTab.suggestedContent}
              />
            </div>
          ) : (
            <>
              <div className="editor-container">
                <div className="line-numbers-gutter" ref={lineNumbersRef}>
                  <div className="line-number-container">
                    {paragraphs.map((p, index) => (
                      <div key={index} className="line-number" style={{ top: `${p.top}px` }}>
                        {index + 1}
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  ref={editorRef}
                  className="tiptap-editor"
                  onContextMenu={handleContextMenu}
                  onClick={handleEditorClick}
                  onScroll={(e) => {
                    const container = lineNumbersRef.current?.querySelector('.line-number-container');
                    if (container) {
                      container.style.transform = `translateY(-${e.target.scrollTop}px)`;
                    }
                  }}
                />
              </div>
              {/* 字符统计显示 - 移动到编辑框外的右下角 */}
              <div className="character-count-container">
                <div className="character-count">
                  总字符数: {characterCount}
                </div>
              </div>
              {showContextMenu && (
                <ContextMenu
                  x={contextMenuPos.x}
                  y={contextMenuPos.y}
                  items={getContextMenuItems(TiptapEditorInstance.current, (action) => 
                    handleMenuItemClick(TiptapEditorInstance.current, action)
                  )}
                  onClose={handleCloseContextMenu}
                />
              )}
            </>
          )}
        </div>
      )}
      {showModal && (
        <NotificationModal message={modalMessage} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}


export default EditorPanel;
