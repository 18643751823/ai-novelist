import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setShowApiSettingsModal,
  setShowRagSettingsModal,
  setShowGeneralSettingsModal,
  setShowHomePage,
  // setShowWorkspacePanel, // 暂时注释掉
  setShowPersistentMemoryPanel
} from '../store/slices/chatSlice';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGear,
  faBook,
  faRobot,
  faPencil,
  faBriefcase,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import './SidebarComponent.css';

const SidebarComponent = () => {
  const dispatch = useDispatch();
  const [activeItem, setActiveItem] = useState(null);

  // 获取当前模态框状态
  const showApiSettingsModal = useSelector(state => state.chat.ui.showApiSettingsModal);
  const showRagSettingsModal = useSelector(state => state.chat.ui.showRagSettingsModal);
  const showGeneralSettingsModal = useSelector(state => state.chat.ui.showGeneralSettingsModal);
  const showHomePage = useSelector(state => state.chat.ui.showHomePage);
  // const showWorkspacePanel = useSelector(state => state.chat.ui.showWorkspacePanel); // 暂时注释掉
  const showPersistentMemoryPanel = useSelector(state => state.chat.ui.showPersistentMemoryPanel);

  // 关闭所有模态框并显示主页面的函数
  const showHomePageAndCloseModals = () => {
    dispatch(setShowApiSettingsModal(false));
    dispatch(setShowRagSettingsModal(false));
    dispatch(setShowGeneralSettingsModal(false));
    // dispatch(setShowWorkspacePanel(false)); // 暂时注释掉
    dispatch(setShowPersistentMemoryPanel(false));
    dispatch(setShowHomePage(true));
  };

  // 侧边栏项目配置 - 每个图标绑定独立的设置模态框
  const sidebarItems = [
    {
      id: 'home',
      icon: faPencil,
      label: '首页',
      action: () => {
        // 点击首页按钮，关闭所有模态框并显示主页面
        showHomePageAndCloseModals();
        setActiveItem('home');
      }
    },
    // 暂时注释掉工作流面板项目
    // {
    //   id: 'workspace',
    //   icon: faBriefcase,
    //   label: '工作区',
    //   action: () => {
    //     if (showWorkspacePanel) {
    //       // 如果当前已经打开，则关闭
    //       dispatch(setShowWorkspacePanel(false));
    //       dispatch(setShowHomePage(true));
    //       setActiveItem(null);
    //     } else {
    //       // 如果当前未打开，则关闭其他模态框并打开当前模态框
    //       dispatch(setShowHomePage(false));
    //       dispatch(setShowApiSettingsModal(false));
    //       dispatch(setShowRagSettingsModal(false));
    //       dispatch(setShowGeneralSettingsModal(false));
    //       dispatch(setShowPersistentMemoryPanel(false));
    //       dispatch(setShowWorkspacePanel(true));
    //       setActiveItem('workspace');
    //     }
    //   }
    // },
    {
      id: 'api-settings',
      icon: faGear,
      label: 'API设置',
      action: () => {
        if (showApiSettingsModal) {
          // 如果当前已经打开，则关闭
          dispatch(setShowApiSettingsModal(false));
          dispatch(setShowHomePage(true));
          setActiveItem(null);
        } else {
          // 如果当前未打开，则关闭其他模态框并打开当前模态框
          dispatch(setShowHomePage(false));
          // dispatch(setShowWorkspacePanel(false)); // 暂时注释掉
          dispatch(setShowRagSettingsModal(false));
          dispatch(setShowGeneralSettingsModal(false));
          dispatch(setShowPersistentMemoryPanel(false));
          dispatch(setShowApiSettingsModal(true));
          setActiveItem('api-settings');
        }
      }
    },
    {
      id: 'rag-settings',
      icon: faBook,
      label: 'rag知识库',
      action: () => {
        if (showRagSettingsModal) {
          // 如果当前已经打开，则关闭
          dispatch(setShowRagSettingsModal(false));
          dispatch(setShowHomePage(true));
          setActiveItem(null);
        } else {
          // 如果当前未打开，则关闭其他模态框并打开当前模态框
          dispatch(setShowHomePage(false));
          // dispatch(setShowWorkspacePanel(false)); // 暂时注释掉
          dispatch(setShowApiSettingsModal(false));
          dispatch(setShowGeneralSettingsModal(false));
          dispatch(setShowPersistentMemoryPanel(false));
          dispatch(setShowRagSettingsModal(true));
          setActiveItem('rag-settings');
        }
      }
    },
    {
      id: 'general-settings',
      icon: faRobot,
      label: 'agent设置',
      action: () => {
        if (showGeneralSettingsModal) {
          // 如果当前已经打开，则关闭
          dispatch(setShowGeneralSettingsModal(false));
          dispatch(setShowHomePage(true));
          setActiveItem(null);
        } else {
          // 如果当前未打开，则关闭其他模态框并打开当前模态框
          dispatch(setShowHomePage(false));
          // dispatch(setShowWorkspacePanel(false)); // 暂时注释掉
          dispatch(setShowApiSettingsModal(false));
          dispatch(setShowRagSettingsModal(false));
          dispatch(setShowPersistentMemoryPanel(false));
          dispatch(setShowGeneralSettingsModal(true));
          setActiveItem('general-settings');
        }
      }
    },
    {
      id: 'insert-info',
      icon: faInfoCircle,
      label: '插入信息',
      action: () => {
        if (showPersistentMemoryPanel) {
          // 如果当前已经打开，则关闭
          dispatch(setShowPersistentMemoryPanel(false));
          dispatch(setShowHomePage(true));
          setActiveItem(null);
        } else {
          // 如果当前未打开，则关闭其他模态框并打开当前模态框
          dispatch(setShowHomePage(false));
          // dispatch(setShowWorkspacePanel(false)); // 暂时注释掉
          dispatch(setShowApiSettingsModal(false));
          dispatch(setShowRagSettingsModal(false));
          dispatch(setShowGeneralSettingsModal(false));
          dispatch(setShowPersistentMemoryPanel(true));
          setActiveItem('insert-info');
        }
      }
    }
  ];

  const handleItemClick = (item) => {
    item.action();
  };

  // 根据当前打开的模态框更新 activeItem 状态
  React.useEffect(() => {
    if (showApiSettingsModal) {
      setActiveItem('api-settings');
    } else if (showRagSettingsModal) {
      setActiveItem('rag-settings');
    } else if (showGeneralSettingsModal) {
      setActiveItem('general-settings');
    }
    // else if (showWorkspacePanel) { // 暂时注释掉
    //   setActiveItem('workspace');
    // }
    else if (showPersistentMemoryPanel) {
      setActiveItem('insert-info');
    } else if (showHomePage) {
      setActiveItem('home');
    } else {
      setActiveItem(null);
    }
  }, [showApiSettingsModal, showRagSettingsModal, showGeneralSettingsModal, /* showWorkspacePanel, */ showPersistentMemoryPanel, showHomePage]);

  return (
    <div className="sidebar">
      {/* 侧边栏项目列表 */}
      <div className="sidebar-items">
        {sidebarItems.map((item) => (
          <div
            key={item.id}
            className={`sidebar-item ${activeItem === item.id ? 'active' : ''}`}
            onClick={() => handleItemClick(item)}
            title={item.label}
          >
            <FontAwesomeIcon icon={item.icon} className="item-icon" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SidebarComponent;
