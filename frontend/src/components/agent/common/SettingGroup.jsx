import React from 'react';
import './SettingGroup.css';

/**
 * 统一的设置项组件
 * 提供一致的设置项布局和样式
 */
const SettingGroup = ({
  title,
  children,
  description,
  className = '',
  collapsible = false,
  defaultCollapsed = false
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div className={`setting-group ${className}`}>
      {title && (
        <div 
          className={`setting-group-header ${collapsible ? 'collapsible' : ''}`}
          onClick={toggleCollapse}
        >
          <h4 className="setting-group-title">{title}</h4>
          {collapsible && (
            <span className="collapse-icon">
              {isCollapsed ? '▶' : '▼'}
            </span>
          )}
        </div>
      )}
      
      {description && !isCollapsed && (
        <div className="setting-group-description">
          {description}
        </div>
      )}
      
      {!isCollapsed && (
        <div className="setting-group-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default SettingGroup;