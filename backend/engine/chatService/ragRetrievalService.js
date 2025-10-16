const retriever = require('../../rag-service/retriever');

// 获取 RAG 检索设置
async function getRagSettings(mode) {
  let ragTableNames = [];
  let retrievalTopK = 3; // 默认值
  
  try {
    const StoreModule = await import('electron-store');
    const Store = StoreModule.default;
    const storeInstance = new Store();
    
    // 获取当前模式的RAG表选择设置
    const modeFeatureSettings = storeInstance.get('modeFeatureSettings') || {};
    const currentModeSettings = modeFeatureSettings[mode] || {};
    // 如果用户没有选择任何表，传递 null 而不是空数组
    ragTableNames = currentModeSettings.ragTableNames || null;
    
    // 获取存储的检索设置
    retrievalTopK = storeInstance.get('retrievalTopK') || 3;
    
    console.log(`[RagRetrievalService] RAG设置 - 模式: ${mode}, 选择的表:`, ragTableNames, `topK: ${retrievalTopK}`);
  } catch (error) {
    console.warn('[RagRetrievalService] 获取RAG设置失败，使用默认值:', error.message);
    ragTableNames = null; // 出错时也跳过检索
  }
  
  return { ragTableNames, retrievalTopK };
}

// 执行 RAG 检索
async function performRagRetrieval(messages, ragRetrievalEnabled, mode) {
  if (!ragRetrievalEnabled) {
    return { ragContext: '', retrievalInfo: null };
  }
  
  const lastUserMessage = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMessage || !lastUserMessage.content) {
    return { ragContext: '', retrievalInfo: null };
  }
  
  try {
    // 获取 RAG 设置
    const { ragTableNames, retrievalTopK } = await getRagSettings(mode);
    
    // 初始化 RAG 检索器
    try {
      const handlers = require('../ipc/handlers');
      if (handlers.storeInstance) {
        await retriever.initialize(handlers.storeInstance);
      }
    } catch (error) {
      console.warn('[RagRetrievalService] 无法获取storeInstance，RAG功能可能受限:', error.message);
    }
    
    // 使用增强的检索功能，启用意图分析，并传递当前模式和选择的表
    const retrievalResult = await retriever.retrieve(messages, retrievalTopK, true, mode, ragTableNames);
    
    if (retrievalResult.documents && retrievalResult.documents.length > 0) {
      // 根据模式提供差异化的引导语句
      let ragGuidance = '';
      if (mode === 'writing') {
        ragGuidance = '这些内容主要作为文风、句式结构和描写方式的参考。请模仿其中的写作风格和表达方式。';
      } else if (mode === 'adjustment') {
        ragGuidance = '这些内容主要作为风格一致性和语言表达的参考。请确保修改后的内容与参考风格保持一致。';
      } else if (mode === 'outline') {
        ragGuidance = '这些内容主要作为情节结构和叙事手法的参考。可以参考其中的故事架构技巧。';
      } else {
        ragGuidance = '这些内容仅供参考，请根据当前任务需求合理使用。';
      }
      
      // 构建RAG上下文
      const ragContext = `\n\n[知识库参考内容]：
这是从知识库中检索到的相关内容，${ragGuidance}
请注意：这些内容可能与当前剧情无关，请谨慎参考，不要将其作为实际剧情内容。

检索到的参考内容：
${retrievalResult.documents.map(doc => `- ${doc}`).join('\n')}\n`;
      
      console.log('[RagRetrievalService] 已成功注入增强的RAG上下文。');
      if (retrievalResult.isAnalyzed) {
        console.log('[RagRetrievalService] 意图分析已启用，检索优化完成');
      }
      
      return { ragContext, retrievalInfo: retrievalResult };
    }
  } catch (error) {
    console.error('[RagRetrievalService] RAG检索失败:', error.message);
  }
  
  return { ragContext: '', retrievalInfo: null };
}

module.exports = {
  getRagSettings,
  performRagRetrieval
};