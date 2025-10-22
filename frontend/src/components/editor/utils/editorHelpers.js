/**
 * 将 Tiptap JSON 转换为纯文本
 * @param {Object} jsonContent - Tiptap JSON 内容
 * @returns {string} 纯文本内容
 */
export const convertTiptapJsonToText = (jsonContent) => {
  if (!jsonContent || !jsonContent.content) return '';
  
  const extractText = (node) => {
    if (node.type === 'text') {
      return node.text || '';
    }
    
    if (node.content && Array.isArray(node.content)) {
      return node.content.map(extractText).join('');
    }
    
    return '';
  };
  
  return jsonContent.content.map(extractText).join('\n');
};

/**
 * 将纯文本转换为 Tiptap JSON
 * @param {string} text - 纯文本内容
 * @returns {Object} Tiptap JSON 内容
 */
export const convertTextToTiptapJson = (text) => {
  if (!text) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: []
        }
      ]
    };
  }
  
  const lines = text.split('\n');
  const content = lines.map(line => ({
    type: 'paragraph',
    content: line ? [{ type: 'text', text: line }] : []
  }));
  
  return {
    type: 'doc',
    content
  };
};

/**
 * 获取上下文菜单项
 * @param {Object} TiptapEditorInstance - Tiptap 编辑器实例
 * @param {Function} handleMenuItemClick - 菜单项点击处理函数
 * @returns {Array} 菜单项数组
 */
export const getContextMenuItems = (TiptapEditorInstance, handleMenuItemClick) => {
  const isSelectionActive = TiptapEditorInstance ? !TiptapEditorInstance.state.selection.empty : false;
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

/**
 * 处理菜单项点击
 * @param {Object} editor - Tiptap 编辑器实例
 * @param {string} action - 操作类型
 */
export const handleMenuItemClick = (editor, action) => {
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
};