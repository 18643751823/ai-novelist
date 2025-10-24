import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setShowWorkspacePanel } from '../../store/slices/chatSlice';
import WorkflowEditor from './components/WorkflowEditor';
import './WorkspacePanel.css';

const WorkspacePanel = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const showWorkspacePanel = useSelector(state => state.chat.ui.showWorkspacePanel);

  const handleClose = () => {
    dispatch(setShowWorkspacePanel(false));
    if (onClose) onClose();
  };

  if (!isOpen && !showWorkspacePanel) return null;

  return (
    <div className="workspace-panel">
      {/* 自定义工作流编辑器 */}
      <WorkflowEditor />
    </div>
  );
};

export default WorkspacePanel;