import React, { useRef, useEffect, useState, forwardRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

const MarkdownMessageRenderer = forwardRef(({
  value = '',
  onChange,
  height = 'auto',
  placeholder = '',
  isStreaming = false // 新增：流式传输状态
}, ref) => {
  const vditorRef = useRef(null);
  const [vditorInstance, setVditorInstance] = useState(null);
  const lastValueRef = useRef(''); // 用于跟踪上一次的值

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
    lastValueRef.current = value;

    return () => {
      if (vditor && typeof vditor.destroy === 'function') {
        try {
          vditor.destroy();
          setVditorInstance(null); // 清理实例引用
        } catch (error) {
          console.warn('消息编辑器销毁错误:', error);
        }
      }
    };
  }, []);

  // 当外部 value 变化时更新编辑器内容
  useEffect(() => {
    if (vditorInstance && typeof vditorInstance.getValue === 'function' && typeof vditorInstance.setValue === 'function') {
      try {
        // 添加额外的安全检查，确保 Vditor 实例处于有效状态
        if (vditorInstance.vditor && vditorInstance.vditor.ir) {
          const currentValue = vditorInstance.getValue();
          
          // 优化流式更新：只在内容确实变化时更新，避免不必要的渲染
          if (value !== lastValueRef.current) {
            if (isStreaming) {
              // 流式传输时使用增量更新，避免闪烁
              vditorInstance.setValue(value);
            } else {
              // 非流式传输时正常更新
              vditorInstance.setValue(value);
            }
            lastValueRef.current = value;
          }
        }
      } catch (error) {
        console.warn('消息编辑器内容更新错误:', error);
      }
    }
  }, [value, vditorInstance, isStreaming]);

  // 提供编辑器实例的方法给父组件
  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      if (vditorInstance && typeof vditorInstance.getValue === 'function' && vditorInstance.vditor && vditorInstance.vditor.ir) {
        try {
          return vditorInstance.getValue();
        } catch (error) {
          console.warn('获取编辑器值错误:', error);
          return '';
        }
      }
      return '';
    },
    setValue: (content) => {
      if (vditorInstance && typeof vditorInstance.setValue === 'function' && vditorInstance.vditor && vditorInstance.vditor.ir) {
        try {
          vditorInstance.setValue(content);
        } catch (error) {
          console.warn('设置编辑器值错误:', error);
        }
      }
    },
    insertValue: (content) => {
      if (vditorInstance && typeof vditorInstance.insertValue === 'function' && vditorInstance.vditor && vditorInstance.vditor.ir) {
        try {
          vditorInstance.insertValue(content);
          // 更新内部状态
          lastValueRef.current = vditorInstance.getValue();
        } catch (error) {
          console.warn('插入编辑器值错误:', error);
        }
      }
    },
    // 新增：流式传输时追加内容的方法
    appendValue: (content) => {
      if (vditorInstance && typeof vditorInstance.insertValue === 'function' && vditorInstance.vditor && vditorInstance.vditor.ir) {
        try {
          vditorInstance.insertValue(content);
          // 更新内部状态
          lastValueRef.current = vditorInstance.getValue();
        } catch (error) {
          console.warn('追加编辑器值错误:', error);
        }
      }
    },
    focus: () => {
      if (vditorInstance && typeof vditorInstance.focus === 'function' && vditorInstance.vditor && vditorInstance.vditor.ir) {
        try {
          vditorInstance.focus();
        } catch (error) {
          console.warn('编辑器聚焦错误:', error);
        }
      }
    },
    getHTML: () => {
      if (vditorInstance && typeof vditorInstance.getHTML === 'function' && vditorInstance.vditor && vditorInstance.vditor.ir) {
        try {
          return vditorInstance.getHTML();
        } catch (error) {
          console.warn('获取编辑器HTML错误:', error);
          return '';
        }
      }
      return '';
    },
    destroy: () => {
      if (vditorInstance && typeof vditorInstance.destroy === 'function') {
        try {
          vditorInstance.destroy();
        } catch (error) {
          console.warn('编辑器销毁错误:', error);
        }
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