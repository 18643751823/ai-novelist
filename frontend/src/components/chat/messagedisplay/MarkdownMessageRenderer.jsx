import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import './MarkdownMessageRenderer.css';

const MarkdownMessageRenderer = forwardRef(({
  value = '',
  onChange,
  height = 'auto',
  placeholder = '',
  isStreaming = false // 新增：流式传输状态
}, ref) => {
  const lastValueRef = useRef(''); // 用于跟踪上一次的值

  // 初始化编辑器
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: typeof value === 'string' ? value : (value?.content || ''),
    editable: !!onChange, // 只有当onChange存在时才可编辑
    onUpdate: ({ editor }) => {
      if (onChange) {
        const html = editor.getHTML();
        onChange(html);
      }
    },
    onCreate: ({ editor }) => {
      console.log('消息编辑器初始化完成');
    },
  });

  // 当外部 value 变化时更新编辑器内容
  useEffect(() => {
    if (editor && value !== lastValueRef.current) {
      // 优化流式更新：只在内容确实变化时更新，避免不必要的渲染
      if (isStreaming) {
        // 流式传输时使用增量更新，避免闪烁
        editor.commands.setContent(value, false);
      } else {
        // 非流式传输时正常更新
        editor.commands.setContent(value);
      }
      lastValueRef.current = value;
    }
  }, [value, editor, isStreaming]);

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
        // 更新内部状态
        lastValueRef.current = editor.getHTML();
      }
    },
    // 新增：流式传输时追加内容的方法
    appendValue: (content) => {
      if (editor) {
        editor.chain().focus().insertContent(content).run();
        // 更新内部状态
        lastValueRef.current = editor.getHTML();
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
    <div className="markdown-message-renderer">
      <div className="editor-content" style={{ height }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

export default MarkdownMessageRenderer;