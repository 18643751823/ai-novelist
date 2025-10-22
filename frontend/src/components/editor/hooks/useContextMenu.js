import { useCallback, useState } from 'react';

/**
 * 上下文菜单 Hook
 * 处理右键菜单的显示、隐藏和位置管理
 */
export const useContextMenu = () => {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false);
  }, []);

  return {
    showContextMenu,
    contextMenuPos,
    handleContextMenu,
    handleCloseContextMenu,
    setShowContextMenu
  };
};