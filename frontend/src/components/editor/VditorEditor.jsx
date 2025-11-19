import React, { useRef, useEffect, useState, forwardRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './VditorEditor.css';
import { convertMarkdownToPlainText, copyToClipboard } from '../../utils/markdownToPlainText';
import NotificationModal from '../others/NotificationModal';
import imageUploadService from '../../services/imageUploadService';

const VditorEditor = forwardRef(({
  value = '',
  onChange,
  mode = 'ir',
  placeholder = '开始编写您的 Markdown 内容...',
  onInstanceReady = null
}, ref) => {
  const vditorRef = useRef(null);
  const [vditorInstance, setVditorInstance] = useState(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  
  // 使用 ref 来访问最新的 Vditor 实例
  const vditorInstanceRef = useRef(null);

  // 初始化编辑器
  useEffect(() => {
    if (!vditorRef.current) return;

    const vditor = new Vditor(vditorRef.current, {
      height: '100%',
      mode,
      placeholder,
      value,
      theme: 'dark',
      icon: 'ant',
      typewriterMode: true,
      cache: {
        enable: false,
      },
      // 禁用自动去除行首空格的功能
      clean: false,
      // 保留空白字符
      whitespacePre: true,
      input: (content) => {
        if (onChange) {
          onChange(content);
        }
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
          name: 'copy-as-plain-text',
          tip: '复制为纯文本',
          className: 'right',
          icon: '<svg t="1740213545598" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2423" width="16" height="16"><path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32z" fill="#707070" p-id="2424"></path><path d="M704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z" fill="#707070" p-id="2425"></path></svg>',
          click: async () => {
            try {
              const content = vditor.getValue();
              const plainText = convertMarkdownToPlainText(content);
              const success = await copyToClipboard(plainText);
              
              if (success) {
                setNotificationMessage('内容已成功复制为纯文本！');
                setShowNotification(true);
              } else {
                setNotificationMessage('复制失败，请重试');
                setShowNotification(true);
              }
            } catch (error) {
              console.error('复制纯文本失败:', error);
              setNotificationMessage('复制失败，请重试');
              setShowNotification(true);
            }
          }
        },
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
            const file = files[0];
            
            // 使用图片上传服务
            const result = await imageUploadService.uploadImage(file);
            
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
          } catch (error) {
            console.error('上传处理错误:', error);
            throw error;
          }
        },
        drop: true,
        multiple: true,
        tip: '将文件拖拽到此处上传',
      },
      paste: {
        enable: true,
        isUpload: true,
      },
      clipboard: {
        enable: true,
      },
    });

    setVditorInstance(vditor);
    vditorInstanceRef.current = vditor;

    // 通知父组件实例已准备好
    if (onInstanceReady) {
      onInstanceReady(vditor);
    }

    // 清理函数 - 只销毁编辑器实例
    return () => {
      if (vditor && vditor.destroy && vditor.element) {
        try {
          vditor.destroy();
        } catch (error) {
          console.warn('Vditor destroy error:', error);
        }
      }
    };
  }, []); // 空依赖数组，只在挂载时初始化

  // 监听value变化，确保内容更新
  useEffect(() => {
    if (vditorInstance && value !== undefined && vditorInstance.currentMode) {
      // 只有当编辑器内容与传入的value不同时才更新
      const currentContent = vditorInstance.getValue();
      if (currentContent !== value) {
        vditorInstance.setValue(value);
      }
    }
  }, [value, vditorInstance]);

  // 提供编辑器实例的方法给父组件
  React.useImperativeHandle(ref, () => ({
    getValue: () => {
      if (vditorInstance && vditorInstance.getValue && vditorInstance.currentMode) {
        return vditorInstance.getValue();
      }
      return '';
    },
    setValue: (content) => {
      if (vditorInstance && vditorInstance.setValue && vditorInstance.currentMode) {
        vditorInstance.setValue(content);
      }
    },
    insertValue: (content) => {
      if (vditorInstance && vditorInstance.insertValue && vditorInstance.currentMode) {
        vditorInstance.insertValue(content);
      }
    },
    focus: () => {
      if (vditorInstance && vditorInstance.focus && vditorInstance.currentMode) {
        vditorInstance.focus();
      }
    },
    getHTML: () => {
      if (vditorInstance && vditorInstance.getHTML && vditorInstance.currentMode) {
        return vditorInstance.getHTML();
      }
      return '';
    },
    getText: () => {
      if (vditorInstance && vditorInstance.getValue && vditorInstance.currentMode) {
        const content = vditorInstance.getValue();
        // 简单的Markdown到纯文本转换
        return content.replace(/[#*`\[\]()_~]/g, '').replace(/\n+/g, ' ').trim();
      }
      return '';
    },
    destroy: () => {
      if (vditorInstance && vditorInstance.destroy) {
        vditorInstance.destroy();
      }
    },
    // 返回实际的 Vditor 实例
    getVditorInstance: () => vditorInstance,
  }));

  return (
    <div className="vditor-editor">
      <div ref={vditorRef} />
      
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

export default VditorEditor;