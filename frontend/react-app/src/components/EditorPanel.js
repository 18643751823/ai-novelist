import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateNovelTitle, updateTabContent, startDiff, endDiff } from '../store/slices/novelSlice';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import HardBreak from '@tiptap/extension-hard-break';
import DiffViewer from './DiffViewer'; // 引入 DiffViewer
import ContextMenu from './ContextMenu'; // 引入 ContextMenu

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faSave, faExchangeAlt } from '@fortawesome/free-solid-svg-icons'; // 添加图标

import './EditorPanel.css';
import NotificationModal from './NotificationModal';
import backgroundImage from '../assets/背景.png'; // 导入背景图片
 
import useIpcRenderer from '../hooks/useIpcRenderer';
import { convertTiptapJsonToText, convertTextToTiptapJson } from '../utils/tiptap-helpers.js';
 
 function EditorPanel() {
  const dispatch = useDispatch();
  const { openTabs, activeTabId } = useSelector((state) => state.novel);
  const activeTab = openTabs.find(tab => tab.id === activeTabId);

  const editorRef = useRef(null);
  const TiptapEditorInstance = useRef(null);
  const titleInputRef = useRef(null);
  const initialContentRef = useRef(activeTab?.content); // 用 activeTab 的内容初始化
  const { invoke } = useIpcRenderer();
  // hasUnsavedChanges 将直接从 activeTab.isDirty 派生
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [paragraphs, setParagraphs] = useState([]);
  const lineNumbersRef = useRef(null);
 
  // 保存文件内容的函数 (现在不接受参数，直接从组件状态中获取)
  // 保存文件内容的函数 (现在不接受参数，直接从组件状态中获取)
  // 保存文件内容的函数 (现在不接受参数，直接从组件状态中获取)
  const saveContent = useCallback(
    async (isManualSave = false) => {
      if (!activeTab) {
        console.warn('无法保存：没有激活的标签页。');
        return { success: false, error: '没有激活的标签页。' };
      }

      const { id: filePath, content } = activeTab;

      console.log('[EditorPanel] saveContent: 尝试保存文件，filePath:', filePath);

      if (!filePath) {
        console.warn('无法保存文件：文件路径无效。', filePath);
        return { success: false, error: '文件路径无效。' };
      }

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
          console.log('文件保存成功！');
          // 保存成功后，更新状态
          dispatch(updateTabContent({ tabId: filePath, content, isDirty: false }));
          initialContentRef.current = content; // 更新 initialContent
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
      }
    },
    [invoke, activeTab, dispatch]
  );
 
  // 使用 useRef 存储 saveContent 的最新引用
  const saveContentRef = useRef(saveContent);
  useEffect(() => {
    saveContentRef.current = saveContent;
  }, [saveContent]);

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

  // 修改 handleSaveButtonClick 调用 saveContent 时传入 true
  const handleSaveButtonClick = useCallback(() => {
    saveContent(true); // 传入 true 表示手动保存
  }, [saveContent]);


  const handleCloseTab = useCallback(() => {
    setModalMessage('功能待开发');
    setShowModal(true);
  }, []);
  
  const [title, setTitle] = useState('未命名');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [isTitleEditing, setIsTitleEditing] = useState(false);
 
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

    const changed = newContent !== initialContentRef.current;
    if (window.electron) {
        window.electron.setUnsavedChanges(changed);
    }

    updateParagraphs();
  }, [dispatch, activeTab?.id, updateParagraphs]); // 依赖于 activeTab.id 而不是整个对象
 
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
        setTimeout(updateParagraphs, 50);
      }
    }
  }, [activeTab?.content]); // Precise dependency

  // Effect for updating the 'isDirty' status in the main process
  useEffect(() => {
    if (window.electron && activeTab) {
      window.electron.setUnsavedChanges(activeTab.isDirty);
    }
  }, [activeTab?.isDirty]);

  useEffect(() => {
    if (activeTab) {
      setTitle(activeTab.title);
    } else {
      setTitle('未命名');
    }
  }, [activeTab?.id, activeTab?.title]); // Depend on specific properties

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  const handleMenuItemClick = useCallback((action) => {
    const editor = TiptapEditorInstance.current;
    if (!editor) return;

    switch (action) {
      case 'cut':
        if (!editor.state.selection.empty) {
          navigator.clipboard.writeText(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '));
          editor.commands.deleteSelection();
        }
        break;
      case 'copy':
        if (!editor.state.selection.empty) {
          navigator.clipboard.writeText(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '));
        }
        break;
      case 'paste':
        navigator.clipboard.readText().then(text => {
          editor.commands.insertContent(text);
        }).catch(err => console.error('Failed to read clipboard contents: ', err));
        break;
      case 'insert':
        console.log('Insert clicked (functionality not yet implemented)');
        break;
      default:
        break;
    }
    // No need to call setShowContextMenu(false) here, as ContextMenu's onClose will handle it.
  }, []);

  const getContextMenuItems = () => {
    const isSelectionActive = TiptapEditorInstance.current ? !TiptapEditorInstance.current.state.selection.empty : false;
    const items = [
      {
        label: '剪切',
        onClick: () => handleMenuItemClick('cut'),
        disabled: !isSelectionActive,
      },
      {
        label: '复制',
        onClick: () => handleMenuItemClick('copy'),
        disabled: !isSelectionActive,
      },
      {
        label: '粘贴',
        onClick: () => handleMenuItemClick('paste'),
      },
    ];
    return items;
  };

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


  return (
    <>
      {!activeTab ? (
        <div
          className="no-file-selected-panel"
          style={{
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: '20% auto',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        >
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
                  onFocus={() => {
                    if (title === '未命名') {
                      setTitle('');
                    }
                  }}
                  onBlur={handleTitleSave}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      await handleTitleSave();
                      if (TiptapEditorInstance.current) {
                        TiptapEditorInstance.current.commands.focus('start');
                      }
                    }
                  }}
                />
                <button className="save-button" onClick={() => saveContent(true)}>
                  <FontAwesomeIcon icon={faSave} />
                </button>
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
                ></div>
              </div>
              {showContextMenu && (
                <ContextMenu
                  x={contextMenuPos.x}
                  y={contextMenuPos.y}
                  items={getContextMenuItems()}
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