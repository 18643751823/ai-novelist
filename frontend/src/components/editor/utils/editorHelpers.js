/**
 * 获取上下文菜单项
 * @param {Object} TiptapEditorInstance - Tiptap 编辑器实例
 * @param {Function} handleMenuItemClick - 菜单项点击处理函数
 * @returns {Array} 菜单项数组
 */
export const getContextMenuItems = (TiptapEditorInstance, handleMenuItemClick) => {
  if (!TiptapEditorInstance) {
    return [];
  }

  return [
    {
      label: '剪切',
      action: 'cut',
      disabled: !TiptapEditorInstance.state.selection.empty
    },
    {
      label: '复制',
      action: 'copy',
      disabled: !TiptapEditorInstance.state.selection.empty
    },
    {
      label: '粘贴',
      action: 'paste'
    },
    {
      type: 'separator'
    },
    {
      label: '撤销',
      action: 'undo',
      disabled: !TiptapEditorInstance.can().undo()
    },
    {
      label: '重做',
      action: 'redo',
      disabled: !TiptapEditorInstance.can().redo()
    },
    {
      type: 'separator'
    },
    {
      label: '全选',
      action: 'selectAll'
    },
    {
      type: 'separator'
    },
    {
      label: '插入链接',
      action: 'insertLink'
    },
    {
      label: '插入图片',
      action: 'insertImage'
    }
  ];
};

/**
 * 处理菜单项点击
 * @param {Object} editor - Tiptap 编辑器实例
 * @param {string} action - 操作类型
 */
export const handleMenuItemClick = (editor, action) => {
  if (!editor) return;

  switch (action) {
    case 'cut':
      document.execCommand('cut');
      break;
    case 'copy':
      document.execCommand('copy');
      break;
    case 'paste':
      document.execCommand('paste');
      break;
    case 'undo':
      if (editor.can().undo()) {
        editor.chain().focus().undo().run();
      }
      break;
    case 'redo':
      if (editor.can().redo()) {
        editor.chain().focus().redo().run();
      }
      break;
    case 'selectAll':
      editor.commands.selectAll();
      break;
    case 'insertLink':
      const url = window.prompt('输入链接地址:');
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
      break;
    case 'insertImage':
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          // 这里需要调用图片上传服务
          console.log('图片上传功能需要实现');
        }
      };
      input.click();
      break;
    default:
      break;
  }
};