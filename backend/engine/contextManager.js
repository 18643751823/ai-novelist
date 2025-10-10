const logger = require('../utils/logger');
const { state } = require('../state-manager');

/**
 * 上下文管理服务
 * 负责处理对话历史的截断和上下文限制
 */
class ContextManager {
  constructor() {
    this.defaultSettings = {
      modes: {
        general: {
          chatContext: { type: 'turns', value: 20 },
          ragContext: { type: 'turns', value: 10 }
        },
        outline: {
          chatContext: { type: 'turns', value: 30 },
          ragContext: { type: 'turns', value: 15 }
        },
        writing: {
          chatContext: { type: 'turns', value: 20 },
          ragContext: { type: 'turns', value: 15 }
        },
        adjustment: {
          chatContext: { type: 'turns', value: 15 },
          ragContext: { type: 'turns', value: 8 }
        }
      }
    };
  }

  /**
   * 根据上下文限制设置截断消息历史
   * @param {Array} messages 完整的消息历史
   * @param {Object} contextSettings 上下文设置
   * @param {string} mode 当前模式
   * @param {boolean} isRagContext 是否为RAG上下文
   * @returns {Array} 截断后的消息
   */
  truncateMessages(messages, contextSettings, mode, isRagContext = false) {
    if (!messages || messages.length === 0) {
      return messages;
    }

    // 获取当前模式的上下文设置
    const modeSettings = contextSettings.modes[mode] || this.defaultSettings.modes[mode];
    if (!modeSettings) {
      console.warn(`[ContextManager] 未找到模式 ${mode} 的上下文设置，使用默认设置`);
      return messages;
    }

    const contextConfig = isRagContext ? modeSettings.ragContext : modeSettings.chatContext;
    
    // 添加详细的上下文限制日志
    const contextType = isRagContext ? 'RAG上下文' : '对话上下文';
    const configInfo = contextConfig.type === 'tokens' && contextConfig.value === 'full'
      ? '满tokens'
      : `附加${contextConfig.value}轮上下文`;
    console.log(`[ContextManager] ${contextType}限制配置: 模式=${mode}, 类型=${contextConfig.type}, 值=${configInfo}, 原始消息=${messages.length}条`);
    
    // 如果设置为满tokens，不进行截断
    if (contextConfig.type === 'tokens' && contextConfig.value === 'full') {
      return messages;
    }

    // 按轮数截断
    if (contextConfig.type === 'turns') {
      const maxTurns = contextConfig.value;

      // 计算需要保留的消息数量
      // 改为附加maxTurns轮上下文（保留最近maxTurns+1轮对话）
      const userMessages = messages.filter(msg => msg.role === 'user');
      if (userMessages.length <= maxTurns + 1) {
        return messages; // 如果消息数量少于限制，返回全部
      }

      // 找到需要保留的最早的用户消息（附加maxTurns轮上下文）
      const earliestUserMessageToKeep = userMessages[userMessages.length - (maxTurns + 1)];
      
      // 直接使用数组索引而不是消息ID来定位截断点
      const userMessageIndex = messages.indexOf(earliestUserMessageToKeep);
      
      if (userMessageIndex === -1) {
        console.warn('[ContextManager] 无法找到截断起始点，返回全部消息');
        return messages;
      }

      // 返回从指定索引开始的消息
      return messages.slice(userMessageIndex);
    }

    // 按tokens截断（未来实现）
    if (contextConfig.type === 'tokens') {
      // TODO: 实现按tokens估算和截断
      console.log('[ContextManager] 按tokens截断功能尚未实现，返回全部消息');
      return messages;
    }

    return messages;
  }

  /**
   * 估算消息的tokens数量（简化版本）
   * @param {Array} messages 消息数组
   * @returns {number} 估算的tokens数量
   */
  estimateTokens(messages) {
    if (!messages || messages.length === 0) {
      return 0;
    }

    // 简化估算：每个字符大约0.25个token（英文），中文大约0.5个token
    let totalTokens = 0;
    for (const message of messages) {
      if (message.content) {
        // 粗略估算：中文字符按2个token，英文字符按0.25个token
        const chineseChars = (message.content.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishChars = message.content.length - chineseChars;
        totalTokens += chineseChars * 2 + englishChars * 0.25;
      }
    }

    return Math.ceil(totalTokens);
  }

  /**
   * 获取当前模式的上下文设置
   * @param {Object} contextSettings 上下文设置
   * @param {string} mode 模式名称
   * @param {boolean} isRagContext 是否为RAG上下文
   * @returns {Object} 上下文配置
   */
  getContextConfig(contextSettings, mode, isRagContext = false) {
    const modeSettings = contextSettings.modes[mode] || this.defaultSettings.modes[mode];
    if (!modeSettings) {
      console.warn(`[ContextManager] 未找到模式 ${mode} 的上下文设置，使用默认设置`);
      return isRagContext 
        ? this.defaultSettings.modes.general.ragContext 
        : this.defaultSettings.modes.general.chatContext;
    }

    return isRagContext ? modeSettings.ragContext : modeSettings.chatContext;
  }

  /**
   * 验证上下文设置
   * @param {Object} settings 上下文设置
   * @returns {boolean} 是否有效
   */
  validateContextSettings(settings) {
    console.log('[contextManager] 开始验证上下文设置');
    
    if (!settings || !settings.modes) {
      console.error('[contextManager] 验证失败: settings或settings.modes为空');
      console.error('[contextManager] settings:', settings);
      return false;
    }

    console.log('[contextManager] settings.modes:', Object.keys(settings.modes));
    
    const validModes = ['general', 'outline', 'writing', 'adjustment'];
    for (const mode of validModes) {
      if (!settings.modes[mode]) {
        console.error(`[contextManager] 验证失败: 缺少模式 ${mode}`);
        return false;
      }

      const modeSettings = settings.modes[mode];
      console.log(`[contextManager] ${mode} 模式设置:`, modeSettings);
      
      if (!modeSettings.chatContext || !modeSettings.ragContext) {
        console.error(`[contextManager] 验证失败: ${mode} 模式缺少chatContext或ragContext`);
        console.error(`[contextManager] chatContext:`, modeSettings.chatContext);
        console.error(`[contextManager] ragContext:`, modeSettings.ragContext);
        return false;
      }

      // 验证chatContext
      if (!this._validateContextConfig(modeSettings.chatContext)) {
        console.error(`[contextManager] 验证失败: ${mode} 模式的chatContext无效`);
        console.error(`[contextManager] chatContext详情:`, modeSettings.chatContext);
        return false;
      }

      // 验证ragContext
      if (!this._validateContextConfig(modeSettings.ragContext)) {
        console.error(`[contextManager] 验证失败: ${mode} 模式的ragContext无效`);
        console.error(`[contextManager] ragContext详情:`, modeSettings.ragContext);
        return false;
      }
    }

    console.log('[contextManager] 所有模式验证通过');
    return true;
  }

  /**
   * 验证单个上下文配置
   * @param {Object} config 上下文配置
   * @returns {boolean} 是否有效
   */
  _validateContextConfig(config) {
    console.log('[contextManager] 验证单个上下文配置:', config);
    
    if (!config || !config.type) {
      console.error('[contextManager] 配置验证失败: config或config.type为空');
      return false;
    }

    if (config.type === 'turns') {
      const isValid = typeof config.value === 'number' && config.value >= 1 && config.value <= 50;
      if (!isValid) {
        console.error('[contextManager] turns配置验证失败:', config);
        console.error('[contextManager] value应为1-50的数字，实际:', config.value, '类型:', typeof config.value);
      }
      return isValid;
    }

    if (config.type === 'tokens') {
      const isValid = config.value === 'full' || (typeof config.value === 'number' && config.value > 0);
      if (!isValid) {
        console.error('[contextManager] tokens配置验证失败:', config);
        console.error('[contextManager] value应为"full"或正数，实际:', config.value, '类型:', typeof config.value);
      }
      return isValid;
    }

    console.error('[contextManager] 配置验证失败: 未知的type类型:', config.type);
    return false;
  }
}

// 创建单例实例
const contextManager = new ContextManager();

module.exports = contextManager;