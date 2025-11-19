import React, { useState, useEffect } from 'react';
import providerConfigService from '../../../services/providerConfigService';
import NotificationModal from '../../others/NotificationModal';
import './CustomProviderSettings.css';

const CustomProviderSettings = ({ onSaveComplete, editingProvider: initialEditingProvider, configs, onConfigsUpdate }) => {
    const [editingProvider, setEditingProvider] = useState(initialEditingProvider || null);
    const [isEditing, setIsEditing] = useState(!!initialEditingProvider);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');

    // 当传入的编辑提供商发生变化时更新状态
    useEffect(() => {
        if (initialEditingProvider) {
            setEditingProvider(initialEditingProvider);
            setIsEditing(true);
        }
    }, [initialEditingProvider]);

    const handleSave = async (providerData) => {
        try {
            // 使用新的API保存自定义提供商
            const saveResult = await providerConfigService.saveCustomProvider(
                providerData.providerName,
                providerData.baseURL,
                providerData.apiKey
            );
            
            if (saveResult.success) {
                setNotificationMessage('自定义提供商保存成功！');
                
                // 通知父组件保存完成
                if (onSaveComplete) {
                    onSaveComplete();
                }
                
                setEditingProvider(null);
                setIsEditing(false);
            } else {
                setNotificationMessage('保存自定义提供商失败，请重试。');
            }
            
            setShowNotification(true);
        } catch (error) {
            console.error('保存自定义提供商失败:', error);
            setNotificationMessage('保存失败，请重试。');
            setShowNotification(true);
        }
    };

    const handleAddNew = () => {
        setEditingProvider({
            providerName: '',
            apiKey: '',
            baseURL: '',
            modelId: '',
            enabled: true
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setEditingProvider(null);
        setIsEditing(false);
    };

    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setEditingProvider(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };
    
    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (editingProvider.providerName) {
            handleSave(editingProvider);
        }
    };

    if (isEditing) {
        return (
            <div className="custom-provider-form">
                <h3>{editingProvider.providerName ? '编辑' : '新增'}提供商</h3>
                <form onSubmit={handleFormSubmit}>
                    <input name="providerName" value={editingProvider.providerName} onChange={handleFormChange} placeholder="提供商名称 (唯一标识)" required />
                    <input name="apiKey" type="password" value={editingProvider.apiKey} onChange={handleFormChange} placeholder="API Key" />
                    <input name="baseURL" value={editingProvider.baseURL} onChange={handleFormChange} placeholder="Base URL (e.g., https://.../v1)" required />
                    <label>
                        <input name="enabled" type="checkbox" checked={editingProvider.enabled} onChange={handleFormChange} />
                        启用
                    </label>
                    <div className="form-actions">
                        <button type="submit">保存</button>
                        <button type="button" onClick={handleCancel}>取消</button>
                    </div>
                </form>
                
                {showNotification && (
                    <NotificationModal
                        message={notificationMessage}
                        onClose={() => setShowNotification(false)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="custom-provider-settings">
            <h3>添加自定义提供商</h3>
            <p>配置兼容 OpenAI API 的自定义提供商</p>
            <button onClick={handleAddNew}>新增提供商</button>
            
            {showNotification && (
                <NotificationModal
                    message={notificationMessage}
                    onClose={() => setShowNotification(false)}
                />
            )}
        </div>
    );
};

export default CustomProviderSettings;