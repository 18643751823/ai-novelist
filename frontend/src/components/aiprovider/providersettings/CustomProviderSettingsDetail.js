import React, { useState } from 'react';
import ConfirmationModal from '../../others/ConfirmationModal';

const CustomProviderSettingsDetail = ({ provider, onEdit, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  if (!provider) {
    return <div className="no-provider-data">提供商数据不存在</div>;
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(provider);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (onDelete) {
      await onDelete(provider.providerName);
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="custom-provider-detail">
      <div className="setting-group">
        <label>提供商名称</label>
        <input type="text" value={provider.providerName} readOnly />
      </div>

      <div className="setting-group">
        <label>API Key</label>
        <input type="password" value={provider.apiKey} readOnly />
      </div>

      <div className="setting-group">
        <label>Base URL</label>
        <input type="text" value={provider.baseURL} readOnly />
      </div>

      <div className="setting-group">
        <label>模型 ID</label>
        <input type="text" value={provider.modelId} readOnly />
      </div>

      <div className="setting-group">
        <label>状态</label>
        <div className={`status-badge ${provider.enabled ? 'enabled' : 'disabled'}`}>
          {provider.enabled ? '已启用' : '已禁用'}
        </div>
      </div>

      <div className="setting-actions">
        <button className="edit-btn" onClick={handleEdit}>编辑</button>
        <button className="delete-btn" onClick={handleDeleteClick}>删除</button>
      </div>

      {/* 删除确认对话框 - 使用项目标准的 ConfirmationModal */}
      {showDeleteConfirm && (
        <ConfirmationModal
          message={`确定要删除提供商 "${provider.providerName}" 吗？此操作不可撤销。`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default CustomProviderSettingsDetail;