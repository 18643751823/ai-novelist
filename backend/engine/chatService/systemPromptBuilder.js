const prompts = require('../prompts');
const { getFileTree } = require('../../utils/file-tree-builder');
const { app } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');

// 统一获取 novel 目录路径的辅助函数
const getNovelPath = () => {
    if (isDev) {
        // 开发环境：位于项目根目录
        return path.join(app.getAppPath(), 'novel');
    } else {
        // 生产环境：位于 .exe 文件同级目录
        return path.join(path.dirname(app.getPath('exe')), 'novel');
    }
};

// 动态组合系统提示词
function buildSystemPrompt(basePrompt, options = {}) {
  let prompt = basePrompt;
  
  // 新增：文件结构树信息 - 放在主体系统提示词之后，其他信息之前
  if (options.fileTreeContent) {
    prompt += options.fileTreeContent;
  }
  
  // 新增：持久记忆信息
  if (options.additionalInfo) {
    const info = options.additionalInfo;
    let memoryContent = '\n\n[持久记忆信息]:\n';
    
    if (info.outline) {
      memoryContent += `\n【大纲】:\n${info.outline}\n`;
    }
    if (info.previousChapter) {
      memoryContent += `\n【上一章全文】:\n${info.previousChapter}\n`;
    }
    if (info.characterSettings) {
      memoryContent += `\n【本章重要人设】:\n${info.characterSettings}\n`;
    }
    
    prompt += memoryContent;
  }
  
  // RAG内容控制
  if (options.ragRetrievalEnabled && options.ragContent) {
    prompt += options.ragContent;
  }
  
  return prompt;
}

// 获取文件结构树内容
async function getFileTreeContent() {
  try {
    const novelPath = getNovelPath();
    const fileTreeResult = await getFileTree(novelPath);
    let fileTreeContent = '';
    
    if (fileTreeResult && fileTreeResult.success) {
      const formatFileTree = (nodes, indent = 0) => {
        let result = '';
        for (const node of nodes) {
          const prefix = ' '.repeat(indent * 2) + '- ';
          result += `${prefix}${node.title}${(node.type === 'folder' ? '/' : '')}\n`;
          if (node.children && node.children.length > 0) {
            result += formatFileTree(node.children, indent + 1);
          }
        }
        return result;
      };
      fileTreeContent = `\n\n[当前工作区文件结构 (novel 目录)]:\n${formatFileTree(fileTreeResult.tree)}\n`;
    } else {
      console.warn(`获取 novel 目录文件树失败: ${fileTreeResult.error}`);
      fileTreeContent = `\n\n[获取 novel 目录文件结构失败: ${fileTreeResult.error}]\n`;
    }
    
    return fileTreeContent;
  } catch (error) {
    console.error('[SystemPromptBuilder] 获取文件结构树失败:', error.message);
    return `\n\n[获取文件结构树失败: ${error.message}]\n`;
  }
}

// 获取持久记忆信息
async function getAdditionalInfo(mode) {
  let additionalInfo = {
    outline: '',
    previousChapter: '',
    characterSettings: ''
  };
  
  try {
    const StoreModule = await import('electron-store');
    const Store = StoreModule.default;
    const storeInstance = new Store();
    
    const additionalInfoData = storeInstance.get('additionalInfo') || {};
    const modeInfo = additionalInfoData[mode];
    
    if (typeof modeInfo === 'string') {
      // 旧格式：字符串，迁移到新格式
      additionalInfo = {
        outline: modeInfo,
        previousChapter: '',
        characterSettings: ''
      };
      console.log('[SystemPromptBuilder] 检测到旧格式附加信息，已迁移到新格式，模式:', mode);
    } else if (typeof modeInfo === 'object' && modeInfo !== null) {
      // 新格式：对象
      additionalInfo = {
        outline: modeInfo.outline || '',
        previousChapter: modeInfo.previousChapter || '',
        characterSettings: modeInfo.characterSettings || ''
      };
      console.log('[SystemPromptBuilder] 已加载新格式附加信息，模式:', mode);
    } else {
      // 空数据
      additionalInfo = {
        outline: '',
        previousChapter: '',
        characterSettings: ''
      };
    }
    
    console.log('[SystemPromptBuilder] 附加信息详情:', {
      outlineLength: additionalInfo.outline.length,
      previousChapterLength: additionalInfo.previousChapter.length,
      characterSettingsLength: additionalInfo.characterSettings.length
    });
  } catch (error) {
    console.warn('[SystemPromptBuilder] 获取附加信息失败:', error.message);
    additionalInfo = {
      outline: '',
      previousChapter: '',
      characterSettings: ''
    };
  }
  
  return additionalInfo;
}

// 获取系统提示词
function getSystemPrompt(mode, customSystemPrompt = null) {
  const selectedSystemPrompt = prompts[mode] || prompts['general'];
  const effectiveSystemPrompt = customSystemPrompt && customSystemPrompt.trim() !== ''
                                ? customSystemPrompt
                                : selectedSystemPrompt;
  console.log(`[SystemPromptBuilder] 系统提示词选择 - 模式: ${mode}, 自定义: "${customSystemPrompt}", 最终使用: "${effectiveSystemPrompt}"`);
  
  return effectiveSystemPrompt;
}

module.exports = {
  buildSystemPrompt,
  getFileTreeContent,
  getAdditionalInfo,
  getSystemPrompt
};