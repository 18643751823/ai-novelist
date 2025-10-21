import React, { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { setShowGeneralSettingsModal } from '../store/slices/chatSlice';
import TabBar from './editor/TabBar'; // 引入 TabBar
import SidebarComponent from './SidebarComponent'; // 引入侧边栏组件
import SplitViewPanel from './editor/SplitViewPanel'; // 引入分屏对比组件
import OverlayPanel from './OverlayPanel'; // 引入覆盖层组件
import ApiSettingsModal from './aiprovider/ApiSettingsModal'; // 引入API设置模态框
import RagManagementPanel from './rag/RagManagementPanel'; // 引入RAG管理面板（已合并模态框功能）
import AgentPanel from './agent/AgentPanel'; // 引入统一的Agent面板
import WorkspacePanel from './workflow-editor/WorkspacePanel'; // 引入工作区面板
import PersistentMemoryPanel from './insert/PersistentMemoryPanel'; // 引入持久记忆面板

function LayoutComponent({ chapterPanel, editorPanel, chatPanel }) {
  const dispatch = useDispatch();
  const { splitView } = useSelector((state) => state.novel);
  // 保持 leftPanelSize 和 rightPanelSize 作为初始尺寸，也可以作为拖动后的尺寸
  const [leftPanelSize, setLeftPanelSize] = useState(20);
  const [rightPanelSize, setRightPanelSize] = useState(20);
  
  // 获取模态框状态
  const showApiSettingsModal = useSelector(state => state.chat.showApiSettingsModal);
  const showRagSettingsModal = useSelector(state => state.chat.showRagSettingsModal);
  const showGeneralSettingsModal = useSelector(state => state.chat.showGeneralSettingsModal);
  const showWorkspacePanel = useSelector(state => state.chat.showWorkspacePanel);
  const showPersistentMemoryPanel = useSelector(state => state.chat.showPersistentMemoryPanel);
  
  // 如果有任何模态框打开，就显示覆盖层
  const showOverlay = showApiSettingsModal || showRagSettingsModal ||
                     showGeneralSettingsModal || showWorkspacePanel || showPersistentMemoryPanel;

  // 处理左侧面板尺寸变化
  const handleLeftPanelChange = (size) => {
    setLeftPanelSize(size);
  };

  // 处理右侧面板尺寸变化
  const handleRightPanelChange = (size) => {
    setRightPanelSize(size);
  };

  return (
    <div className="layout-container">
      <PanelGroup direction="horizontal" className="main-layout">
        {/* 左侧组件栏 - 固定宽度图标栏，不能拖动 */}
        <div className="sidebar-panel-fixed">
          <SidebarComponent />
        </div>
        
        {/* 细长的普通灰色分隔线 */}
        <div className="divider-line"></div>
        
        {/* 章节面板 */}
        <Panel
          defaultSize={leftPanelSize} /* 使用 defaultSize 允许用户拖动 */
          minSize={0} /* 允许完全隐藏 */
          maxSize={100} /* 允许全范围拖动 */
          className="left-panel"
          onResize={handleLeftPanelChange} /* 监听尺寸变化 */
        >
          {chapterPanel}
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        
        {/* 编辑器面板 */}
        <Panel
          defaultSize={60}
          minSize={0}
          maxSize={100}
          className="middle-panel"
          style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {!splitView.enabled && <TabBar />}
          <div className="editor-content-wrapper">
            {splitView.enabled ? <SplitViewPanel /> : editorPanel}
          </div>
        </Panel>
        <PanelResizeHandle className="resize-handle" />
        
        {/* 聊天面板 */}
        <Panel
          defaultSize={rightPanelSize} /* 使用 defaultSize 允许用户拖动 */
          minSize={0} /* 允许完全隐藏 */
          maxSize={100} /* 允许全范围拖动 */
          className="right-panel"
          style={{ overflow: 'hidden' }}
          onResize={handleRightPanelChange} /* 监听尺寸变化 */
        >
          {chatPanel}
        </Panel>
      </PanelGroup>

      {/* 覆盖层 - 覆盖章节列表栏和编辑栏 */}
      <OverlayPanel isVisible={showOverlay}>
        {/* 根据当前打开的模态框显示相应的内容 */}
        {showApiSettingsModal && (
          <ApiSettingsModal isOpen={showApiSettingsModal} />
        )}
        {showRagSettingsModal && (
          <RagManagementPanel isOpen={showRagSettingsModal} />
        )}
        {showGeneralSettingsModal && (
          <AgentPanel isOpen={showGeneralSettingsModal} onClose={() => dispatch(setShowGeneralSettingsModal(false))} />
        )}
        {showWorkspacePanel && (
          <WorkspacePanel isOpen={showWorkspacePanel} />
        )}
        {showPersistentMemoryPanel && (
          <PersistentMemoryPanel />
        )}
      </OverlayPanel>
    </div>
  );
}

export default LayoutComponent;