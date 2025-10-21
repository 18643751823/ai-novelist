import React, { useEffect, useRef, useState } from 'react';
import './ContextMenu.css';

function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prevIndex) =>
          prevIndex > 0 ? prevIndex - 1 : items.length - 1
        );
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prevIndex) =>
          prevIndex < items.length - 1 ? prevIndex + 1 : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex !== -1) {
          items[selectedIndex].onClick();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [items, selectedIndex, onClose]);

  useEffect(() => {
    if (menuRef.current) {
      menuRef.current.focus();
    }
  }, []);

  if (!x || !y || !items.length) return null;

  return (
    <ul
      className="context-menu"
      ref={menuRef}
      style={{ top: y, left: x }}
      tabIndex="-1"
    >
      {items.map((item, index) => (
        <li
          key={index}
          className={selectedIndex === index ? 'selected' : ''}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export default ContextMenu;