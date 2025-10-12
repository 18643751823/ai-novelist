import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setAdditionalInfoForMode,
  resetAdditionalInfoForMode,
  setAdditionalInfoForAllModes,
  setShowRagSettingsModal
} from '../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSave } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../hooks/useIpcRenderer';
import FileSearch from './FileSearch';

const MemorySettingsTab = forwardRef(({ onSaveComplete }, ref) => {
  const dispatch = useDispatch();
  const { invoke } = useIpcRenderer();
  const { additionalInfo } = useSelector((state) => state.chat);
  
  const [localAdditionalInfo, setLocalAdditionalInfo] = useState({});
  const [selectedMode, setSelectedMode] = useState('general');
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  useEffect(() => {
    // 处理附加信息的旧格式迁移
    const migratedAdditionalInfo = {};
    for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
      const modeInfo = additionalInfo[mode];
      if (typeof modeInfo === 'string') {
        migratedAdditionalInfo[mode] = {
          outline: modeInfo,
          previousChapter: '',
          characterSettings: ''
        };
      } else if (typeof modeInfo === 'object' && modeInfo !== null) {
        migratedAdditionalInfo[mode] = {
          outline: modeInfo.outline || '',
          previousChapter: modeInfo.previousChapter || '',
          characterSettings: modeInfo.characterSettings || ''
        };
      } else {
        migratedAdditionalInfo[mode] = {
          outline: '',
          previousChapter: '',
          characterSettings: ''
        };
      }
    }
    setLocalAdditionalInfo(migratedAdditionalInfo);
  }, [additionalInfo]);

  const handleAdditionalInfoChange = (mode, field, value) => {
    setLocalAdditionalInfo(prev => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [field]: value
      }
    }));
  };

  // 加载文件内容到指定字段
  const loadFileContent = async (filePath, field) => {
    setIsLoadingFile(true);
    try {
      const result = await invoke('load-chapter-content', filePath);
      if (result.success) {
        handleAdditionalInfoChange(selectedMode, field, result.content);
      } else {
        console.error('加载文件内容失败:', result.error);
      }
    } catch (error) {
      console.error('加载文件时出错:', error);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // 处理文件选择
  const handleFileSelect = (field) => (file) => {
    loadFileContent(file.path, field);
  };

  // 应用到全部模式
  const handleApplyToAllModes = () => {
    const currentInfo = localAdditionalInfo[selectedMode];
    for (const mode of ['general', 'outline', 'writing', 'adjustment']) {
      setLocalAdditionalInfo(prev => ({
        ...prev,
        [mode]: { ...currentInfo }
      }));
      // 同时更新Redux状态
      dispatch(setAdditionalInfoForMode({
        mode,
        info: { ...currentInfo }
      }));
    }
  };

  const handleSave = async () => {
    try {
      // 保存所有模式的附加信息
      for (const mode of Object.keys(localAdditionalInfo)) {
        dispatch(setAdditionalInfoForMode({ mode, info: localAdditionalInfo[mode] }));
      }
      
      // 保存到持久化存储
      await invoke('set-store-value', 'additionalInfo', localAdditionalInfo);

      // 通知保存成功
      if (onSaveComplete) {
        onSaveComplete('持久记忆设置保存成功！', true);
      }
    } catch (error) {
      console.error('保存持久记忆设置失败:', error);
      // 通知保存失败
      if (onSaveComplete) {
        onSaveComplete('持久记忆设置保存失败，请重试。', false);
      }
    }
  };

  const getModeDisplayName = (mode) => {
    const names = {
      general: '通用',
      outline: '细纲',
      writing: '写作',
      adjustment: '调整'
    };
    return names[mode] || mode;
  };

  // 暴露保存方法给父组件
  useImperativeHandle(ref, () => ({
    handleSave
  }));

  return (
    <div className="tab-content">
      {/* 模式选择器 */}
      <div className="mode-selector" style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#ddd', fontSize: '16px' }}>选择模式:</h4>
        <select
          value={selectedMode}
          onChange={(e) => setSelectedMode(e.target.value)}
          className="mode-dropdown"
          style={{ backgroundColor: '#1e1e1e', color: '#abb2bf', border: '2px solid #555', borderRadius: '6px', padding: '8px 12px', fontSize: '14px', width: '200px' }}
        >
          <option value="general">通用模式</option>
          <option value="outline">细纲模式</option>
          <option value="writing">写作模式</option>
          <option value="adjustment">调整模式</option>
        </select>
      </div>

      {/* 持久记忆编辑器 */}
      <div className="memory-editor">
        <h4 style={{ margin: '0 0 15px 0', color: '#ddd', fontSize: '18px', borderBottom: '2px solid #555', paddingBottom: '10px' }}>
          {getModeDisplayName(selectedMode)}模式持久记忆:
        </h4>
        
        <div className="memory-field" style={{ marginBottom: '20px' }}>
          <h5 style={{ margin: '0 0 8px 0', color: '#ccc', fontSize: '14px', fontWeight: '600' }}>大纲:</h5>
          <FileSearch
            onFileSelect={handleFileSelect('outline')}
            placeholder="搜索大纲相关文件..."
          />
          <textarea
            value={localAdditionalInfo[selectedMode]?.outline || ''}
            onChange={(e) => handleAdditionalInfoChange(selectedMode, 'outline', e.target.value)}
            placeholder="输入本书的大纲内容..."
            rows={6}
            style={{ width: '100%', backgroundColor: '#1e1e1e', color: '#abb2bf', border: '2px solid #555', borderRadius: '6px', padding: '12px', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
          />
        </div>

        <div className="memory-field" style={{ marginBottom: '20px' }}>
          <h5 style={{ margin: '0 0 8px 0', color: '#ccc', fontSize: '14px', fontWeight: '600' }}>上一章全文:</h5>
          <FileSearch
            onFileSelect={handleFileSelect('previousChapter')}
            placeholder="搜索上一章文件..."
          />
          <textarea
            value={localAdditionalInfo[selectedMode]?.previousChapter || ''}
            onChange={(e) => handleAdditionalInfoChange(selectedMode, 'previousChapter', e.target.value)}
            placeholder="输入上一章的完整内容..."
            rows={8}
            style={{ width: '100%', backgroundColor: '#1e1e1e', color: '#abb2bf', border: '2px solid #555', borderRadius: '6px', padding: '12px', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
          />
        </div>

        <div className="memory-field" style={{ marginBottom: '20px' }}>
          <h5 style={{ margin: '0 0 8px 0', color: '#ccc', fontSize: '14px', fontWeight: '600' }}>本章重要人设:</h5>
          <FileSearch
            onFileSelect={handleFileSelect('characterSettings')}
            placeholder="搜索人设相关文件..."
          />
          <textarea
            value={localAdditionalInfo[selectedMode]?.characterSettings || ''}
            onChange={(e) => handleAdditionalInfoChange(selectedMode, 'characterSettings', e.target.value)}
            placeholder="输入本章重要人物的设定信息..."
            rows={6}
            style={{ width: '100%', backgroundColor: '#1e1e1e', color: '#abb2bf', border: '2px solid #555', borderRadius: '6px', padding: '12px', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
          />
        </div>

        {/* 应用到全部模式按钮 */}
        <div className="memory-actions" style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #555', textAlign: 'center' }}>
          <button
            className="apply-all-button"
            onClick={handleApplyToAllModes}
            style={{ backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', transition: 'all 0.2s ease' }}
          >
            应用到全部模式
          </button>
        </div>
      </div>

    </div>
  );
});

export default MemorySettingsTab;