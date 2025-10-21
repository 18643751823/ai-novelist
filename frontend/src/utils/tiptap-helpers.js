// 辅助函数：将 Tiptap 的 JSON 输出转换为纯文本，并确保段落间只有一个换行符
export const convertTiptapJsonToText = (json) => {
    if (!json || !json.content || !Array.isArray(json.content)) {
      return '';
    }

    const lines = json.content.map(node => {
      if (node.type === 'paragraph') {
        if (!node.content || node.content.length === 0) {
          return ''; // 对于空的 p 标签，返回一个空字符串
        }
        // 将段落内的所有 text 类型节点的内容连接起来
        return node.content.map(child => (child.type === 'text' ? child.text : '')).join('');
      }
      return ''; // 忽略非 paragraph 类型的节点
    });

    // 使用单个 \n 连接所有行，并移除末尾可能的多余换行符
    return lines.join('\n').trimEnd();
};

// 反向辅助函数：将纯文本（含\n）转换为 Tiptap 的 JSON 结构
export const convertTextToTiptapJson = (text) => {
    if (typeof text !== 'string') {
      return { type: 'doc', content: [] };
    }

    const lines = text.split('\n');
    const content = lines.map(lineText => ({
      type: 'paragraph',
      content: lineText ? [{ type: 'text', text: lineText }] : [],
    }));

    return {
      type: 'doc',
      content,
    };
};