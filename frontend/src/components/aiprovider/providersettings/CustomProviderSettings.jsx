import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setCustomProviders } from '../../../store/slices/apiSlice';
import useIpcRenderer from '../../../hooks/useIpcRenderer';
import NotificationModal from '../../others/NotificationModal';
import './CustomProviderSettings.css';

const CustomProviderSettings = ({ onSaveComplete, editingProvider: initialEditingProvider }) => {
    const dispatch = useDispatch();
    const { setStoreValue, reinitializeModelProvider } = useIpcRenderer();
    const customProviders = useSelector((state) => state.chat.api.customProviders || []);
    
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
            // 更新 Redux Store 中的自定义提供商列表
            const existingIndex = customProviders.findIndex(p => p.providerName === providerData.providerName);
            let updatedProviders;
            
            if (existingIndex > -1) {
                updatedProviders = [...customProviders];
                updatedProviders[existingIndex] = providerData;
            } else {
                updatedProviders = [...customProviders, providerData];
            }
            
            // 更新 Redux Store
            dispatch(setCustomProviders(updatedProviders));
            
            // 保存到持久化存储
            await setStoreValue('customProviders', updatedProviders);
            
            // 重新初始化模型提供者
            try {
                const result = await reinitializeModelProvider();
                if (result.success) {
                    setNotificationMessage('自定义提供商设置已保存！模型提供者已重新初始化，现在可以使用新的API密钥。');
                } else {
                    setNotificationMessage('自定义提供商设置已保存，但重新初始化模型提供者失败。可能需要重启应用。');
                }
            } catch (error) {
                console.error('重新初始化模型提供者失败:', error);
                setNotificationMessage('自定义提供商设置已保存，但重新初始化模型提供者失败。可能需要重启应用。');
            }
            
            setShowNotification(true);
            
            // 通知父组件保存完成
            if (onSaveComplete) {
                onSaveComplete();
            }
            
            setEditingProvider(null);
            setIsEditing(false);
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
                    <input name="apiKey" type="password" value={editingProvider.apiKey} onChange={handleFormChange} placeholder="API Key" required />
                    <input name="baseURL" value={editingProvider.baseURL} onChange={handleFormChange} placeholder="Base URL (e.g., https://.../v1)" required />
                    <input name="modelId" value={editingProvider.modelId} onChange={handleFormChange} placeholder="模型 ID" required />
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