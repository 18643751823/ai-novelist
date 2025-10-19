import React, { useState, useEffect, useCallback } from 'react';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import NotificationModal from '../others/NotificationModal';
import ConfirmationModal from '../others/ConfirmationModal';
import './CustomProviderSettings.css';

const CustomProviderSettings = ({ onSaveComplete, editingProvider: initialEditingProvider }) => {
    const { getStoreValue, setStoreValue, reinitializeModelProvider } = useIpcRenderer();
    const [providers, setProviders] = useState([]);
    const [editingProvider, setEditingProvider] = useState(initialEditingProvider || null);
    const [isEditing, setIsEditing] = useState(!!initialEditingProvider);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState('');
    const [onConfirmCallback, setOnConfirmCallback] = useState(() => () => {});
    const [onCancelCallback, setOnCancelCallback] = useState(() => () => {});

    const loadProviders = useCallback(async () => {
        const storedProviders = await getStoreValue('customProviders') || [];
        setProviders(storedProviders);
    }, [getStoreValue]);

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    // 当传入的编辑提供商发生变化时更新状态
    useEffect(() => {
        if (initialEditingProvider) {
            setEditingProvider(initialEditingProvider);
            setIsEditing(true);
        }
    }, [initialEditingProvider]);

    const handleSave = async (providersToSave) => {
        await setStoreValue('customProviders', providersToSave);
        
        // 尝试重新初始化模型提供者，而不是要求重启应用
        try {
            const result = await reinitializeModelProvider();
            if (result.success) {
                setNotificationMessage('自定义提供商设置已保存！模型提供者已重新初始化，现在可以使用新的API密钥。');
                setShowNotification(true);
                // 通知父组件保存完成
                if (onSaveComplete) {
                    onSaveComplete();
                }
            } else {
                setNotificationMessage('自定义提供商设置已保存，但重新初始化模型提供者失败。可能需要重启应用。');
                setShowNotification(true);
            }
        } catch (error) {
            console.error('重新初始化模型提供者失败:', error);
            setNotificationMessage('自定义提供商设置已保存，但重新初始化模型提供者失败。可能需要重启应用。');
            setShowNotification(true);
        }
        
        setEditingProvider(null);
        setIsEditing(false);
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

    const handleEdit = (provider) => {
        setEditingProvider({ ...provider });
        setIsEditing(true);
    };
    
    const handleDelete = async (providerNameToDelete) => {
        setConfirmationMessage(`确定要删除提供商 "${providerNameToDelete}" 吗？`);
        setOnConfirmCallback(() => async () => {
            const updatedProviders = providers.filter(p => p.providerName !== providerNameToDelete);
            setProviders(updatedProviders);
            // 直接保存更新后的列表
            await setStoreValue('customProviders', updatedProviders);
            setNotificationMessage('提供商已删除。');
            setShowNotification(true);
            setShowConfirmation(false);
        });
        setOnCancelCallback(() => () => {
            setShowConfirmation(false);
        });
        setShowConfirmation(true);
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
            let updatedProviders;
            const existingIndex = providers.findIndex(p => p.providerName === editingProvider.providerName);
            if (existingIndex > -1) {
                updatedProviders = [...providers];
                updatedProviders[existingIndex] = editingProvider;
            } else {
                updatedProviders = [...providers, editingProvider];
            }
            setProviders(updatedProviders);
            handleSave(updatedProviders); // 将更新后的列表直接传递给 handleSave
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
                
                {showConfirmation && (
                    <ConfirmationModal
                        message={confirmationMessage}
                        onConfirm={onConfirmCallback}
                        onCancel={onCancelCallback}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="custom-provider-settings">
            <h3>管理自定义提供商</h3>
            <button onClick={handleAddNew}>新增提供商</button>
            <ul>
                {providers.map(provider => (
                    <li key={provider.providerName}>
                        <span>{provider.providerName} ({provider.modelId}) - {provider.enabled ? '已启用' : '已禁用'}</span>
                        <div className="provider-actions">
                            <button onClick={() => handleEdit(provider)}>编辑</button>
                            <button onClick={() => handleDelete(provider.providerName)}>删除</button>
                        </div>
                    </li>
                ))}
            </ul>
            
            {showNotification && (
                <NotificationModal
                    message={notificationMessage}
                    onClose={() => setShowNotification(false)}
                />
            )}
            
            {showConfirmation && (
                <ConfirmationModal
                    message={confirmationMessage}
                    onConfirm={onConfirmCallback}
                    onCancel={onCancelCallback}
                />
            )}
        </div>
    );
};

export default CustomProviderSettings;