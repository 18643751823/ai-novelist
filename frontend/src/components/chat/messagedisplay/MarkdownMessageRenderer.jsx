import React, { useRef, useEffect, useState, forwardRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

const MarkdownMessageRenderer = forwardRef(({
  value = '',
  onChange,
  height = 'auto',
  placeholder = ''
}, ref) => {
  const vditorRef = useRef(null);
  const [vditorInstance, setVditorInstance] = useState(null);

  useEffect(() => {
    if (!vditorRef.current) return;

    const vditor = new Vditor(vditorRef.current, {
      height: height,
      mode: 'ir', // 即时渲染模式
      placeholder,
      value,
      theme: 'dark',
      icon: 'ant',
      typewriterMode: false,
      cache: {
        enable: false,
      },
      input: (content) => {
        if (onChange) {
          onChange(content);
        }
      },
      focus: () => {
        console.log('消息编辑器获得焦点');
      },
      blur: () => {
        console.log('消息编辑器失去焦点');
      },
      select: () => {
        console.log('消息内容被选中');
      },
      // 禁用工具栏
      toolbar: [],
      preview: {
        markdown: {
          toc: true,
          mark: true,
          footnotes: true,
          autoSpace: false,
        },
        math: {
          engine: 'KaTeX',
        },
        hljs: {
          enable: true,
          style: 'github',
          lineNumber: true,
        },
        theme: {
          current: 'dark',
        },
        actions: [],
      },
      upload: {
        accept: 'image/*',
        handler: async (files) => {
          console.log('消息编辑器上传文件:', files);
          // 消息编辑器不支持上传功能
          return false;
        },
        drop: false,
        multiple: false,
      },
      paste: {
        enable: true,
        isUpload: false, // 禁用粘贴上传
      },
      clipboard: {
        enable: true,
      },
      hint: {
        emoji: {
          '+1': '👍',
          '-1': '👎',
          'heart': '❤️',
          'smile': '😄',
          'tada': '🎉',
          'rocket': '🚀',
        },
      },
      after: () => {
        console.log('消息编辑器初始化完成');
      },
      sanitize: (html) => html,
    });

    setVditorInstance(vditor);

    return () => {
      if (vditor && vditor.destroy) {
        try {
          vditor.destroy();
        } catch (error) {
          console.warn('消息编辑器销毁错误:', error);
        }
      }
    };
  }, []);

  // 当外部 value 变化时更新编辑器内容
  useEffect(() => {
    if (vditorInstance && vditorInstance.getValue && vditorInstance.setValue) {
      try {
        const currentValue = vditorInstance.getValue();
        if (value !== currentValue) {
          vditorInstance.setValue(value);
        }
      } catch (error) {
        console.warn('消息编辑器内容更新错误:', error);
      }
    }
  }, [value, vditorInstance]);

  // 提供编辑器实例的方法给父组件
  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      if (vditorInstance && vditorInstance.getValue) {
        return vditorInstance.getValue();
      }
      return '';
    },
    setValue: (content) => {
      if (vditorInstance && vditorInstance.setValue) {
        vditorInstance.setValue(content);
      }
    },
    insertValue: (content) => {
      if (vditorInstance && vditorInstance.insertValue) {
        vditorInstance.insertValue(content);
      }
    },
    focus: () => {
      if (vditorInstance && vditorInstance.focus) {
        vditorInstance.focus();
      }
    },
    getHTML: () => {
      if (vditorInstance && vditorInstance.getHTML) {
        return vditorInstance.getHTML();
      }
      return '';
    },
    destroy: () => {
      if (vditorInstance && vditorInstance.destroy) {
        vditorInstance.destroy();
      }
    },
  }));

  return (
    <div className="markdown-message-renderer">
      <div ref={vditorRef} />
    </div>
  );
});

export default MarkdownMessageRenderer;