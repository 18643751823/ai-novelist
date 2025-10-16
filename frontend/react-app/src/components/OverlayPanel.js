import React, { useEffect, useRef, useState } from 'react';
import './OverlayPanel.css';

function OverlayPanel({ children, isVisible = false }) {
  const overlayRef = useRef(null);
  const [overlayStyle, setOverlayStyle] = useState({});

  useEffect(() => {
    if (isVisible && overlayRef.current) {
      // 动态计算覆盖区域
      const calculateOverlayArea = () => {
        const sidebar = document.querySelector('.sidebar-panel-fixed');
        const rightPanel = document.querySelector('.right-panel');
        
        
        if (sidebar && rightPanel) {
          const sidebarRect = sidebar.getBoundingClientRect();
          const rightPanelRect = rightPanel.getBoundingClientRect();
          
          // 计算覆盖区域：从侧边栏右侧到右侧面板左侧
          const left = sidebarRect.right;
          const right = rightPanelRect.left;
          const width = Math.max(0, right - left);
          
          
          setOverlayStyle({
            left: `${left}px`,
            width: `${width}px`,
            height: '100%'
          });
        } else {
          console.warn('无法找到侧边栏或右侧面板元素');
        }
      };

      // 初始计算
      const timer = setTimeout(calculateOverlayArea, 100); // 延迟确保DOM已渲染
      
      // 监听窗口大小变化
      window.addEventListener('resize', calculateOverlayArea);
      
      // 监听面板大小变化（使用MutationObserver）
      const observer = new MutationObserver(calculateOverlayArea);
      const mainLayout = document.querySelector('.main-layout');
      if (mainLayout) {
        observer.observe(mainLayout, {
          attributes: true,
          attributeFilter: ['style', 'class'],
          subtree: true
        });
      }
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', calculateOverlayArea);
        observer.disconnect();
      };
    } else {
      // 隐藏时重置样式
      setOverlayStyle({});
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="overlay-panel"
      style={overlayStyle}
    >
      {children}
    </div>
  );
}

export default OverlayPanel;