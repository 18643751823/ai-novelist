import React, { useRef, useEffect, useState, forwardRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import useIpcRenderer from '../../hooks/useIpcRenderer';

const VditorEditor = forwardRef(({
  value = '',
  onChange,
  height = 500,
  mode = 'ir',
  placeholder = '开始编写您的 Markdown 内容...'
}, ref) => {
  const vditorRef = useRef(null);
  const [vditorInstance, setVditorInstance] = useState(null);
  const ipcRenderer = useIpcRenderer();

  useEffect(() => {
    if (!vditorRef.current) return;

    const vditor = new Vditor(vditorRef.current, {
      height,
      mode,
      placeholder,
      value,
      theme: 'dark',
      icon: 'ant',
      typewriterMode: true,
      cache: {
        enable: false,
      },
      input: (content) => {
        if (onChange) {
          onChange(content);
        }
      },
      focus: () => {
        console.log('编辑器获得焦点');
      },
      blur: () => {
        console.log('编辑器失去焦点');
      },
      select: () => {
        console.log('编辑器内容被选中');
      },
      toolbar: [
        'emoji',
        'headings',
        'bold',
        'italic',
        'strike',
        'link',
        '|',
        'list',
        'ordered-list',
        'check',
        'outdent',
        'indent',
        '|',
        'quote',
        'line',
        'code',
        'inline-code',
        'insert-before',
        'insert-after',
        '|',
        'upload',
        'table',
        '|',
        'undo',
        'redo',
        '|',
        'fullscreen',
        'edit-mode',
        {
          name: 'more',
          toolbar: [
            'both',
            'code-theme',
            'content-theme',
            'export',
            'outline',
            'preview',
            'devtools',
            'info',
            'help',
          ],
        }
      ],
      preview: {
        markdown: {
          toc: true,
          mark: true,
          footnotes: true,
          autoSpace: true,
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
          console.log('上传文件:', files);
          
          try {
            if (ipcRenderer) {
              // 处理文件上传
              const file = files[0];
              const arrayBuffer = await file.arrayBuffer();
              
              const result = await ipcRenderer.invoke('upload-image', {
                buffer: Array.from(new Uint8Array(arrayBuffer)),
                name: file.name,
                type: file.type,
                size: file.size
              });
              
              if (result.success) {
                console.log('图片上传成功:', result.data);
                // 使用自定义处理器时，需要手动插入 Markdown 图片语法
                const markdownImage = `![${result.data.filename}](${result.data.url})\n`;
                // 使用 ref 来访问最新的 Vditor 实例
                setTimeout(() => {
                  const currentInstance = vditorInstanceRef.current;
                  if (currentInstance && currentInstance.insertValue) {
                    // 插入图片并在后面添加换行，确保光标在图片后面
                    currentInstance.insertValue(markdownImage);
                    console.log('已插入图片:', markdownImage);
                  } else {
                    console.warn('Vditor 实例不可用，无法插入图片', currentInstance);
                  }
                }, 0);
                return true; // 返回 true 表示成功
              } else {
                console.error('图片上传失败:', result.error);
                throw new Error(result.error);
              }
            } else {
              // 如果没有 IPC，使用本地 URL
              const markdownImage = `![${files[0].name}](${URL.createObjectURL(files[0])})\n`;
              setTimeout(() => {
                const currentInstance = vditorInstanceRef.current;
                if (currentInstance && currentInstance.insertValue) {
                  currentInstance.insertValue(markdownImage);
                  console.log('已插入图片:', markdownImage);
                } else {
                  console.warn('Vditor 实例不可用，无法插入图片', currentInstance);
                }
              }, 0);
              return true;
            }
          } catch (error) {
            console.error('上传处理错误:', error);
            throw error;
          }
        },
        // 启用拖拽上传
        drop: true,
        // 允许拖拽多个文件
        multiple: true,
        // 拖拽上传时的提示文字
        tip: '将文件拖拽到此处上传',
      },
      paste: {
        enable: true,
        isUpload: true,
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
    });

    setVditorInstance(vditor);

    return () => {
      if (vditor && vditor.destroy) {
        try {
          vditor.destroy();
        } catch (error) {
          console.warn('Vditor destroy error:', error);
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
        console.warn('Vditor value update error:', error);
      }
    }
  }, [value, vditorInstance]);

  // 使用 ref 来存储 vditorInstance，确保上传处理器能访问到最新的实例
  const vditorInstanceRef = useRef(null);
  useEffect(() => {
    vditorInstanceRef.current = vditorInstance;
  }, [vditorInstance]);

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
    <div className="vditor-editor">
      <div ref={vditorRef} />
    </div>
  );
});

export default VditorEditor;