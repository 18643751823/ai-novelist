import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faSync, 
  faBook, 
  faTrash, 
  faEdit, 
  faDatabase,
  faCog,
  faFileImport
} from '@fortawesome/free-solid-svg-icons';
import ConfirmationModal from './ConfirmationModal';
import NotificationModal from './NotificationModal';
import useIpcRenderer from '../hooks/useIpcRenderer';
import './RagRepositoryManager.css';

const RagRepositoryManager = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke } = useIpcRenderer();
  
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [notification, setNotification] = useState(null);
  const [showCreateRepoModal, setShowCreateRepoModal] = useState(false);
  const [newRepoConfig, setNewRepoConfig] = useState({
    name: '',
    embeddingModel: '',
    embeddingDimension: 1536,
    chunkSize: 1000,
    chunkOverlap: 200,
    topK: 5,
    similarityThreshold: 0.7
  });

  // 加载仓库列表
  const loadRepositories = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('list-rag-repositories');
      if (result.success) {
        setRepositories(result.repositories || []);
        if (result.repositories && result.repositories.length > 0 && !selectedRepo) {
          setSelectedRepo(result.repositories[0]);
        }
      } else {
        setError(result.error || '获取仓库列表失败');
      }
    } catch (err) {
      console.error('调用获取仓库列表API失败:', err);
      setError('调用API失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 加载选中仓库的文件列表
  const loadRepositoryFiles = async (repoId) => {
    if (!repoId) return;
    
    setLoading(true);
    try {
      const result = await invoke('list-repo-files', repoId);
      if (result.success) {
        setFiles(result.files || []);
      } else {
        setError(result.error || '获取文件列表失败');
      }
    } catch (err) {
      console.error('调用获取文件列表API失败:', err);
      setError('调用API失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 创建新仓库
  const handleCreateRepository = async () => {
    setLoading(true);
    try {
      const result = await invoke('create-rag-repository', newRepoConfig);
      if (result.success) {
        setNotification({
          type: 'success',
          message: `仓库 "${newRepoConfig.name}" 创建成功`,
          duration: 3000
        });
        setShowCreateRepoModal(false);
        setNewRepoConfig({
          name: '',
          embeddingModel: '',
          embeddingDimension: 1536,
          chunkSize: 1000,
          chunkOverlap: 200,
          topK: 5,
          similarityThreshold: 0.7
        });
        await loadRepositories();
      } else {
        setNotification({
          type: 'error',
          message: `创建仓库失败: ${result.error}`,
          duration: 5000
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `创建仓库操作失败: ${err.message}`,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  // 删除仓库
  const handleDeleteRepository = async (repoId) => {
    try {
      const result = await invoke('delete-rag-repository', repoId);
      if (result.success) {
        setNotification({
          type: 'success',
          message: '仓库删除成功',
          duration: 3000
        });
        if (selectedRepo && selectedRepo.id === repoId) {
          setSelectedRepo(null);
          setFiles([]);
        }
        await loadRepositories();
      } else {
        setNotification({
          type: 'error',
          message: `删除失败: ${result.error}`,
          duration: 5000
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `删除操作失败: ${err.message}`,
        duration: 5000
      });
    }
  };

  // 添加文件到仓库
  const handleAddFileToRepo = async () => {
    if (!selectedRepo) {
      setNotification({
        type: 'error',
        message: '请先选择一个仓库',
        duration: 3000
      });
      return;
    }

    setLoading(true);
    try {
      const result = await invoke('add-file-to-rag-repository', selectedRepo.id);
      if (result.success) {
        setNotification({
          type: 'success',
          message: result.message || '文件添加成功',
          duration: 3000
        });
        await loadRepositoryFiles(selectedRepo.id);
      } else {
        setNotification({
          type: 'error',
          message: `添加失败: ${result.error || result.message}`,
          duration: 5000
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `添加操作失败: ${err.message}`,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  // 删除文件
  const handleDeleteFile = async (filename) => {
    if (!selectedRepo) return;
    
    try {
      const result = await invoke('delete-file-from-rag-repository', {
        repoId: selectedRepo.id,
        filename
      });
      if (result.success) {
        setNotification({
          type: 'success',
          message: `文件 "${filename}" 已成功删除`,
          duration: 3000
        });
        await loadRepositoryFiles(selectedRepo.id);
      } else {
        setNotification({
          type: 'error',
          message: `删除失败: ${result.error}`,
          duration: 5000
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `删除操作失败: ${err.message}`,
        duration: 5000
      });
    } finally {
      setDeleteModalOpen(false);
      setFileToDelete(null);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadRepositories();
  }, []);

  // 当选中仓库变化时加载文件
  useEffect(() => {
    if (selectedRepo) {
      loadRepositoryFiles(selectedRepo.id);
    }
  }, [selectedRepo]);

  // 关闭通知
  const closeNotification = () => {
    setNotification(null);
  };

  // 打开删除确认对话框
  const openDeleteConfirm = (file) => {
    setFileToDelete(file);
    setDeleteModalOpen(true);
  };

  // 确认删除
  const confirmDelete = () => {
    if (fileToDelete) {
      handleDeleteFile(fileToDelete.filename);
    }
  };

  // 关闭删除确认对话框
  const closeDeleteConfirm = () => {
    setDeleteModalOpen(false);
    setFileToDelete(null);
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSave: async () => {
      // 这里可以添加保存仓库配置的逻辑
      if (onSaveComplete) {
        onSaveComplete('RAG仓库设置保存成功！', true);
      }
    }
  }));

  return (
    <div className="rag-repository-manager">
      <div className="rag-repo-header">
        <h3>RAG知识库管理</h3>
        <div className="rag-repo-actions">
          <button
            className="create-repo-btn"
            onClick={() => setShowCreateRepoModal(true)}
            disabled={loading}
            title="创建新仓库"
          >
            <FontAwesomeIcon icon={faPlus} />
            新建仓库
          </button>
          <button
            className="refresh-btn"
            onClick={loadRepositories}
            disabled={loading}
            title="刷新列表"
          >
            <FontAwesomeIcon icon={loading ? faSync : faSync} spin={loading} />
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadRepositories}>重试</button>
        </div>
      )}

      <div className="rag-repo-layout">
        {/* 左侧仓库列表 */}
        <div className="repo-list-panel">
          <h4>仓库列表</h4>
          <div className="repo-list">
            {loading ? (
              <div className="loading-state">加载中...</div>
            ) : repositories.length === 0 ? (
              <div className="empty-state">
                暂无仓库，请创建新仓库
              </div>
            ) : (
              repositories.map((repo) => (
                <div
                  key={repo.id}
                  className={`repo-item ${selectedRepo?.id === repo.id ? 'selected' : ''}`}
                  onClick={() => setSelectedRepo(repo)}
                >
                  <div className="repo-info">
                    <div className="repo-name">{repo.name}</div>
                    <div className="repo-details">
                      <span className="file-count">{repo.fileCount || 0} 个文件</span>
                      <span className="embedding-model">{repo.embeddingModel}</span>
                    </div>
                  </div>
                  <div className="repo-actions">
                    <button
                      className="config-btn"
                      title="配置仓库"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: 打开配置弹窗
                      }}
                    >
                      <FontAwesomeIcon icon={faCog} />
                    </button>
                    <button
                      className="delete-btn"
                      title="删除仓库"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRepository(repo.id);
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧文件列表 */}
        <div className="file-list-panel">
          <div className="file-list-header">
            <h4>
              {selectedRepo ? `文件列表 - ${selectedRepo.name}` : '选择仓库查看文件'}
            </h4>
            {selectedRepo && (
              <button
                className="add-file-btn"
                onClick={handleAddFileToRepo}
                disabled={loading}
                title="添加文件到仓库"
              >
                <FontAwesomeIcon icon={faFileImport} />
                添加文件
              </button>
            )}
          </div>

          {selectedRepo ? (
            <div className="file-list">
              {loading ? (
                <div className="loading-state">加载中...</div>
              ) : files.length === 0 ? (
                <div className="empty-state">
                  仓库为空，请添加文件
                </div>
              ) : (
                files.map((file) => (
                  <div key={file.id} className="file-item">
                    <div className="file-info">
                      <div className="file-name">{file.filename}</div>
                      <div className="file-details">
                        <span className="document-count">{file.documentCount} 片段</span>
                        <span className="file-size">{file.size}</span>
                      </div>
                    </div>
                    <div className="file-actions">
                      <button
                        className="delete-btn"
                        onClick={() => openDeleteConfirm(file)}
                        title="删除此文件"
                        disabled={loading}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="no-repo-selected">
              <FontAwesomeIcon icon={faDatabase} size="3x" />
              <p>请从左侧选择一个仓库</p>
            </div>
          )}
        </div>
      </div>

      {/* 创建仓库模态框 */}
      {showCreateRepoModal && (
        <div className="modal-overlay">
          <div className="create-repo-modal">
            <div className="modal-header">
              <h3>创建新仓库</h3>
              <button onClick={() => setShowCreateRepoModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>仓库名称:</label>
                <input
                  type="text"
                  value={newRepoConfig.name}
                  onChange={(e) => setNewRepoConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="输入仓库名称"
                />
              </div>
              <div className="form-group">
                <label>嵌入模型:</label>
                <input
                  type="text"
                  value={newRepoConfig.embeddingModel}
                  onChange={(e) => setNewRepoConfig(prev => ({ ...prev, embeddingModel: e.target.value }))}
                  placeholder="输入嵌入模型名称"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>嵌入维度:</label>
                  <input
                    type="number"
                    value={newRepoConfig.embeddingDimension}
                    onChange={(e) => setNewRepoConfig(prev => ({ ...prev, embeddingDimension: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label>分段大小:</label>
                  <input
                    type="number"
                    value={newRepoConfig.chunkSize}
                    onChange={(e) => setNewRepoConfig(prev => ({ ...prev, chunkSize: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>重叠大小:</label>
                  <input
                    type="number"
                    value={newRepoConfig.chunkOverlap}
                    onChange={(e) => setNewRepoConfig(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label>检索片段数:</label>
                  <input
                    type="number"
                    value={newRepoConfig.topK}
                    onChange={(e) => setNewRepoConfig(prev => ({ ...prev, topK: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>相似度阈值:</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={newRepoConfig.similarityThreshold}
                  onChange={(e) => setNewRepoConfig(prev => ({ ...prev, similarityThreshold: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowCreateRepoModal(false)}>取消</button>
              <button onClick={handleCreateRepository} disabled={loading || !newRepoConfig.name}>
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteModalOpen && (
        <ConfirmationModal
          message={
            fileToDelete ?
            `确定要删除文件 "${fileToDelete.filename}" 吗？\n此操作将永久删除该文件的所有嵌入向量数据，且无法恢复。`
            : '确定要删除吗？'
          }
          onConfirm={confirmDelete}
          onCancel={closeDeleteConfirm}
        />
      )}

      {/* 通知模态框 */}
      {notification && (
        <NotificationModal
          message={notification.message}
          onClose={closeNotification}
        />
      )}
    </div>
  );
});

export default RagRepositoryManager;