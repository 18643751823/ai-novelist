const chatCoordinator = require('./chatService/chatCoordinator');
const messageProcessor = require('./chatService/messageProcessor');

// 重新导出所有功能，保持向后兼容
module.exports = {
  // 主聊天功能
  chatWithAI: chatCoordinator.chatWithAI,
  sendToolResultToAI: chatCoordinator.sendToolResultToAI,
  
  // 消息处理功能
  processUserMessage: messageProcessor.processUserMessage,
  resetResponseCount: messageProcessor.resetResponseCount,
  _sendAiResponseToFrontend: messageProcessor._sendAiResponseToFrontend,
  
  // 流式控制功能
  setStreamingMode: chatCoordinator.setStreamingMode,
  getStreamingMode: chatCoordinator.getStreamingMode,
  abortCurrentRequest: chatCoordinator.abortCurrentRequest,
  setAbortController: chatCoordinator.setAbortController
};
