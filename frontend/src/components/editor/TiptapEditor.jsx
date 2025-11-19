import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { createLowlight } from 'lowlight';
import { convertMarkdownToPlainText, copyToClipboard } from '../../utils/markdownToPlainText';
import NotificationModal from '../others/NotificationModal';
import imageUploadService from '../../services/imageUploadService';
import './TiptapEditor.css';

// 创建语法高亮实例
const lowlight = createLowlight();

const TiptapEditor = forwardRef(({
  value = '',
  onChange,
  placeholder = '开始编写您的内容...',
  onInstanceReady = null
}, ref) => {
  const editorRef = useRef(null);
  const [editorInstance, setEditorInstance] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [activeButtons, setActiveButtons] = useState({
    bold: false,
    italic: false,
    strike: false,
    highlight: false,
    code: false,
    bulletList: false,
    orderedList: false,
    taskList: false,
    codeBlock: false,
    blockquote: false,
    link: false
  });
  
  // 初始化编辑器
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // 禁用默认的代码块，使用带高亮的版本
        link: {
          openOnClick: true,
          HTMLAttributes: {
            class: 'editor-link',
          },
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount.configure({
        limit: null, // 不限制字符数
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'code-block',
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      HorizontalRule.configure({
        HTMLAttributes: {
          class: 'horizontal-rule',
        },
      }),
    ],
    content: typeof value === 'string' ? value : (value?.content || value || ''),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (onChange) {
        onChange(html);
      }
    },
    onCreate: ({ editor }) => {
      setEditorInstance(editor);
      if (onInstanceReady) {
        onInstanceReady(editor);
      }
      
      // 不再在初始化时触发内容更新，避免错误标记为已更改
      // 字符统计将在 EditorPanel 中初始化时处理
    },
    onDestroy: () => {
      setEditorInstance(null);
    },
  });

  // 监听value变化，确保内容更新时字符统计也会更新
  useEffect(() => {
    if (editor && value !== undefined) {
      // 提取实际的内容字符串
      const contentString = typeof value === 'string' ? value : (value?.content || value || '');
      
      // 只有当编辑器内容与传入的value不同时才更新
      const currentContent = editor.getHTML();
      if (currentContent !== contentString) {
        editor.commands.setContent(contentString);
        // 确保字符统计也会更新
        setTimeout(() => {
          if (onChange) {
            onChange(contentString);
          }
        }, 0);
      }
    }
  }, [value, editor, onChange]);

  // 处理图片上传
  const handleImageUpload = async (file) => {
    try {
      const result = await imageUploadService.uploadImage(file);
      if (result.success && editor) {
        // 修复：使用正确的数据路径 result.data.url
        editor.chain().focus().setImage({ src: result.data.url }).run();
      } else {
        setNotificationMessage(`图片上传失败: ${result.error || '未知错误'}`);
        setShowNotification(true);
      }
    } catch (error) {
      console.error('图片上传错误:', error);
      setNotificationMessage(`图片上传失败: ${error.message}`);
      setShowNotification(true);
    }
  };
  // 处理粘贴事件
  useEffect(() => {
    if (!editor) return;

    const handlePaste = (event) => {
      const items = Array.from(event.clipboardData.items);
      const imageItems = items.filter(item => item.type.startsWith('image/'));
      
      if (imageItems.length > 0) {
        event.preventDefault();
        imageItems.forEach(item => {
          const file = item.getAsFile();
          if (file) {
            handleImageUpload(file);
          }
        });
      }
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('paste', handlePaste);

    return () => {
      editorElement.removeEventListener('paste', handlePaste);
    };
  }, [editor]);

  // 处理编辑器点击事件，实现点击空白处定位到最后一行
  useEffect(() => {
    if (!editor) return;

    const handleClick = (event) => {
      // 获取ProseMirror编辑器元素（现在它填满了整个editor-content）
      const proseMirrorElement = editor.view.dom;
      if (!proseMirrorElement || !proseMirrorElement.contains(event.target)) {
        return;
      }
      
      // 获取点击位置相对于编辑器的坐标
      const coords = { left: event.clientX, top: event.clientY };
      const pos = editor.view.posAtCoords(coords);
      
      if (pos) {
        // 检查点击位置是否在文档末尾之后（空白区域）
        const docSize = editor.state.doc.content.size;
        
        // 如果点击位置在文档末尾之后或者点击的是编辑器底部空白区域
        if (pos.pos >= docSize || isClickInBottomEmptyArea(event, proseMirrorElement)) {
          // 将光标移动到文档末尾
          editor.commands.focus('end');
          return;
        }
        
        // 检查点击位置是否在段落之间的空白区域
        const resolvedPos = editor.state.doc.resolve(pos.pos);
        const parent = resolvedPos.parent;
        
        // 如果点击位置在段落之间或块级元素之间的空白区域
        if (parent.type.name === 'doc' || isClickInEmptySpace(event, proseMirrorElement)) {
          // 找到最后一个非空内容位置
          const lastContentPos = findLastContentPosition(editor.state.doc);
          if (lastContentPos >= 0) {
            editor.commands.focus(lastContentPos);
          } else {
            // 如果没有内容，聚焦到开始位置
            editor.commands.focus('start');
          }
        }
      }
    };

    // 判断点击是否在底部空白区域
    const isClickInBottomEmptyArea = (event, proseMirrorElement) => {
      const rect = proseMirrorElement.getBoundingClientRect();
      const contentHeight = proseMirrorElement.scrollHeight;
      const clickY = event.clientY - rect.top;
      
      // 如果点击位置接近底部（最后20px内），认为是底部空白区域
      return clickY > contentHeight - 20;
    };

    // 判断点击是否在空白区域
    const isClickInEmptySpace = (event, proseMirrorElement) => {
      // 获取点击位置下的元素
      const element = document.elementFromPoint(event.clientX, event.clientY);
      
      // 如果点击的是ProseMirror内的空白区域，且不是具体的内容元素
      return element && (
        element.classList.contains('ProseMirror') ||
        (element.closest('.ProseMirror') &&
         !element.closest('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table'))
      );
    };

    // 查找文档中最后一个有内容的位置
    const findLastContentPosition = (doc) => {
      let lastPos = -1;
      doc.content.forEach((node, offset) => {
        if (node.type.name !== 'text' || node.text.trim() !== '') {
          lastPos = offset + node.nodeSize;
        }
      });
      return lastPos;
    };

    // 在ProseMirror元素上添加点击事件监听
    const proseMirrorElement = editor.view.dom;
    if (proseMirrorElement) {
      proseMirrorElement.addEventListener('click', handleClick);
      
      return () => {
        proseMirrorElement.removeEventListener('click', handleClick);
      };
    }
  }, [editor]);

  // 处理拖拽上传
  useEffect(() => {
    if (!editor) return;

    const handleDrop = (event) => {
      event.preventDefault();
      const files = Array.from(event.dataTransfer.files);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      imageFiles.forEach(file => {
        handleImageUpload(file);
      });
    };

    const handleDragOver = (event) => {
      event.preventDefault();
    };

    const editorElement = editor.view.dom;
    editorElement.addEventListener('drop', handleDrop);
    editorElement.addEventListener('dragover', handleDragOver);

    return () => {
      editorElement.removeEventListener('drop', handleDrop);
      editorElement.removeEventListener('dragover', handleDragOver);
    };
  }, [editor]);

  // 提供编辑器实例的方法给父组件
  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      if (editor) {
        return editor.getHTML();
      }
      return '';
    },
    setValue: (content) => {
      if (editor) {
        editor.commands.setContent(content);
      }
    },
    insertValue: (content) => {
      if (editor) {
        editor.chain().focus().insertContent(content).run();
      }
    },
    focus: () => {
      if (editor) {
        editor.commands.focus();
      }
    },
    getHTML: () => {
      if (editor) {
        return editor.getHTML();
      }
      return '';
    },
    getText: () => {
      if (editor) {
        return editor.getText();
      }
      return '';
    },
    destroy: () => {
      if (editor) {
        editor.destroy();
      }
    },
    // 返回实际的编辑器实例
    getEditorInstance: () => editor,
  }));

  // 清理编辑器实例
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  return (
    <div className="tiptap-editor">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-button ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
            title="标题 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-button ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
            title="标题 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`toolbar-button ${editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}`}
            title="标题 3"
          >
            H3
          </button>
        </div>
        
        <div className="toolbar-group">
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, bold: true }));
              editor.chain().focus().toggleBold().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, bold: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.bold ? 'is-active' : ''}`}
            title="粗体"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, italic: true }));
              editor.chain().focus().toggleItalic().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, italic: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.italic ? 'is-active' : ''}`}
            title="斜体"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, strike: true }));
              editor.chain().focus().toggleStrike().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, strike: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.strike ? 'is-active' : ''}`}
            title="删除线"
          >
            <s>S</s>
          </button>
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, highlight: true }));
              editor.chain().focus().toggleHighlight().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, highlight: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.highlight ? 'is-active' : ''}`}
            title="高亮"
          >
            <mark>H</mark>
          </button>
        </div>
        
        <div className="toolbar-group">
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, bulletList: true }));
              editor.chain().focus().toggleBulletList().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, bulletList: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.bulletList ? 'is-active' : ''}`}
            title="无序列表"
          >
            •
          </button>
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, orderedList: true }));
              editor.chain().focus().toggleOrderedList().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, orderedList: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.orderedList ? 'is-active' : ''}`}
            title="有序列表"
          >
            1.
          </button>
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, taskList: true }));
              editor.chain().focus().toggleTaskList().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, taskList: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.taskList ? 'is-active' : ''}`}
            title="任务列表"
          >
            ☑
          </button>
        </div>
        
        <div className="toolbar-group">
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, codeBlock: true }));
              editor.chain().focus().toggleCodeBlock().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, codeBlock: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.codeBlock ? 'is-active' : ''}`}
            title="代码块"
          >
            {'</>'}
          </button>
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, code: true }));
              editor.chain().focus().toggleCode().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, code: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.code ? 'is-active' : ''}`}
            title="行内代码"
          >
            {'<>'}
          </button>
        </div>
        
        <div className="toolbar-group">
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, blockquote: true }));
              editor.chain().focus().toggleBlockquote().run();
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, blockquote: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.blockquote ? 'is-active' : ''}`}
            title="引用"
          >
            "
          </button>
          <button
            onClick={() => {
              // 临时激活按钮，然后立即取消
              setActiveButtons(prev => ({ ...prev, link: true }));
              
              // 检查当前是否有选中的文本
              const { from, to } = editor.state.selection;
              const hasSelection = from !== to;
              const selectedText = hasSelection ? editor.state.doc.textBetween(from, to) : '';
              
              // 提示用户输入链接地址
              const url = window.prompt('输入链接地址:');
              if (url) {
                if (hasSelection) {
                  // 如果有选中文本，直接将选中文本转为链接
                  editor.chain().focus().setLink({ href: url }).run();
                } else {
                  // 如果没有选中文本，使用URL作为链接文本
                  editor.chain().focus().insertContent(`<a href="${url}">${url}</a>`).run();
                }
              }
              
              setTimeout(() => {
                setActiveButtons(prev => ({ ...prev, link: false }));
              }, 100);
            }}
            className={`toolbar-button ${activeButtons.link ? 'is-active' : ''}`}
            title="链接"
          >
            🔗
          </button>
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                  handleImageUpload(file);
                }
              };
              input.click();
            }}
            className="toolbar-button"
            title="插入图片"
          >
            🖼️
          </button>
        </div>
        
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="toolbar-button"
            title="分割线"
          >
            ———
          </button>
        </div>
        
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            className="toolbar-button"
            title="撤销"
            disabled={!editor.can().undo()}
          >
            ↶
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            className="toolbar-button"
            title="重做"
            disabled={!editor.can().redo()}
          >
            ↷
          </button>
        </div>
      </div>
      
      <div className="editor-content" ref={editorRef}>
        <EditorContent editor={editor} />
      </div>
      
      {/* 自定义通知弹窗 */}
      {showNotification && (
        <NotificationModal
          message={notificationMessage}
          onClose={() => setShowNotification(false)}
        />
      )}
    </div>
  );
});

export default TiptapEditor;