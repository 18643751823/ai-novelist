import React from 'react';
import chapterService from '../../services/chapterService';
import configStoreService from '../../services/configStoreService';

/**
 * 设置管理模块
 * 处理设置相关的功能，如API Key管理
 */
const SettingsManager = ({
  apiKey,
  setApiKey,
  setNotificationMessage,
  setShowNotificationModal,
  setShowSettings
}) => {

  /**
   * 处理保存API Key
   */
  const handleSaveApiKey = async () => {
    // 保存 API Key
    const saveResult = await configStoreService.setStoreValue('deepseekApiKey', apiKey);
    
    if (saveResult.success) {
      // 重新初始化模型提供者
      const initResult = await chapterService.reinitializeModelProvider();
      
      if (initResult.success) {
        setNotificationMessage('API Key 已保存！模型提供者已重新初始化。');
      } else {
        setNotificationMessage('API Key 已保存，但重新初始化模型提供者失败。');
      }
    } else {
      setNotificationMessage('保存 API Key 失败！');
    }
    
    setShowNotificationModal(true);
    setShowSettings(false);
  };

  /**
   * 处理取消设置
   */
  const handleCancelSettings = async () => {
    setShowSettings(false);
    // 重新从 store 加载，以防用户取消后恢复旧值
    const result = await configStoreService.getStoreValue('deepseekApiKey');
    if (result.success && result.value) {
      setApiKey(result.value);
    } else {
      setApiKey(''); // 如果没有，则清空
    }
  };

  /**
   * 处理切换设置显示
   */
  const handleToggleSettings = () => {
    setNotificationMessage('此功能已整合到统一设置系统中，请使用聊天栏的设置按钮');
    setShowNotificationModal(true);
  };

  /**
   * 渲染设置界面
   */
  const renderSettings = () => {
    return (
      <div className="settings-modal">
        <div className="settings-content">
          <h3>设置</h3>
          <div className="setting-item">
            <label>DeepSeek API Key:</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入您的 DeepSeek API Key"
            />
          </div>
          <div className="settings-buttons">
            <button onClick={handleSaveApiKey} className="save-button">
              保存
            </button>
            <button onClick={handleCancelSettings} className="cancel-button">
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  return {
    handleSaveApiKey,
    handleCancelSettings,
    handleToggleSettings,
    renderSettings
  };
};

export default SettingsManager;