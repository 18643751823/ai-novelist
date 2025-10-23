/**
 * Markdown 转纯文本工具函数
 * 用于将 Markdown 内容转换为纯文本格式，并添加段落缩进
 */

/**
 * 将 Markdown 转换为纯文本
 * @param {string} markdown - Markdown 内容
 * @returns {string} 转换后的纯文本
 */
export const convertMarkdownToPlainText = (markdown) => {
  if (!markdown) return '';
  
  let text = markdown;
  
  // 移除 Markdown 语法
  // 移除标题标记
  text = text.replace(/^#+\s+/gm, '');
  // 移除粗体和斜体标记
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  // 移除删除线
  text = text.replace(/~~(.*?)~~/g, '$1');
  // 移除高亮标记 (==高亮内容==)
  text = text.replace(/==(.*?)==/g, '$1');
  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  // 先移除图片 - 完全删除整个图片结构 ![描述](链接) (优先级高于链接)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // 再移除链接 - 完全删除整个链接结构 [文本](链接)
  text = text.replace(/\[[^\]]*\]\([^)]*\)/g, '');
  // 移除引用标记
  text = text.replace(/^>\s+/gm, '');
  // 移除列表标记
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');
  // 移除表格标记
  text = text.replace(/\|/g, '');
  text = text.replace(/-+/g, '');
  // 移除自定义图片链接 (如 !paste1761230240389db2o1p.png)
  text = text.replace(/!paste[\w]+\.png/g, '');
  
  // 按段落分割并处理
  const paragraphs = text.split(/\n\s*\n/);
  const processedParagraphs = paragraphs.map(paragraph => {
    // 移除段落内的多余换行和空格
    let cleanParagraph = paragraph.replace(/\n/g, ' ').trim();
    // 如果段落不为空，在开头添加两个空格
    if (cleanParagraph) {
      return '  ' + cleanParagraph;
    }
    return '';
  });
  
  // 重新组合段落，保留空行
  return processedParagraphs.filter(p => p).join('\n\n');
};

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 复制是否成功
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 使用现代 Clipboard API
      await navigator.clipboard.writeText(text);
      console.log('内容已复制到剪贴板');
      return true;
    } else {
      // 使用传统方法
      return fallbackCopyToClipboard(text);
    }
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
};

/**
 * 传统复制方法
 * @param {string} text - 要复制的文本
 * @returns {boolean} 复制是否成功
 */
const fallbackCopyToClipboard = (text) => {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      console.log('内容已复制到剪贴板（传统方法）');
      return true;
    } else {
      console.error('复制失败');
      return false;
    }
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
};

/**
 * 导出所有功能
 */
export default {
  convertMarkdownToPlainText,
  copyToClipboard
};