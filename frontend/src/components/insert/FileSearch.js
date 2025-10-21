import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes, faFile } from '@fortawesome/free-solid-svg-icons';
import useIpcRenderer from '../../hooks/useIpcRenderer';
import './FileSearch.css';

const FileSearch = ({ onFileSelect, placeholder = "搜索novel文件夹下的文件..." }) => {
  const { invoke } = useIpcRenderer();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 搜索文件
  const searchFiles = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await invoke('search-novel-files', query);
      if (result.success) {
        setSearchResults(result.results);
      } else {
        console.error('搜索失败:', result.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('搜索文件时出错:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 防抖搜索
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        searchFiles(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
    setShowResults(true);
  };

  const handleFileSelect = (file) => {
    setSearchQuery('');
    setShowResults(false);
    setSearchResults([]);
    onFileSelect(file);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="file-search-container" ref={searchRef}>
      <div className="file-search-input-wrapper">
        <FontAwesomeIcon icon={faSearch} className="search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="file-search-input"
          onFocus={() => setShowResults(true)}
        />
        {searchQuery && (
          <button onClick={clearSearch} className="clear-search-button">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}
      </div>

      {showResults && searchResults.length > 0 && (
        <div className="search-results-dropdown">
          {searchResults.map((file, index) => (
            <div
              key={index}
              className="search-result-item"
              onClick={() => handleFileSelect(file)}
            >
              <FontAwesomeIcon icon={faFile} className="file-icon" />
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-path">{file.path}</div>
                {file.preview && (
                  <div className="file-preview">{file.preview}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showResults && isSearching && (
        <div className="search-results-dropdown">
          <div className="search-loading">搜索中...</div>
        </div>
      )}

      {showResults && !isSearching && searchQuery && searchResults.length === 0 && (
        <div className="search-results-dropdown">
          <div className="no-results">未找到匹配的文件</div>
        </div>
      )}
    </div>
  );
};

export default FileSearch;