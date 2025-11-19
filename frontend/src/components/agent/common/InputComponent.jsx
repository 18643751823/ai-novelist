import React, { useState, useEffect } from 'react';
import './InputComponent.css';

/**
 * 统一的输入框组件
 * 支持数字输入、标签和描述
 */
const InputComponent = ({
  label,
  value,
  onChange,
  description,
  className = '',
  type = 'number',
  placeholder = '',
  min,
  max,
  step = 1
}) => {
  const [inputValue, setInputValue] = useState(value || '');

  // 同步外部value变化到本地状态
  useEffect(() => {
    console.log(`[InputComponent] 外部value变化:`, value);
    setInputValue(value || '');
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    if (onChange) {
      // 如果是数字类型，转换为数字
      if (type === 'number') {
        const numValue = newValue === '' ? '' : parseFloat(newValue);
        onChange(numValue);
      } else {
        onChange(newValue);
      }
    }
  };

  const handleBlur = () => {
    // 在失去焦点时验证数值范围
    if (type === 'number' && inputValue !== '') {
      let numValue = parseFloat(inputValue);
      
      if (min !== undefined && numValue < min) {
        numValue = min;
      }
      if (max !== undefined && numValue > max) {
        numValue = max;
      }
      
      setInputValue(numValue.toString());
      if (onChange) {
        onChange(numValue);
      }
    }
  };

  return (
    <div className={`input-component ${className}`}>
      {label && (
        <label className="input-label">
          {label}
        </label>
      )}
      
      <div className="input-container">
        <input
          type={type}
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="input-field"
        />
      </div>
      
      {description && (
        <div className="input-description">
          {description}
        </div>
      )}
    </div>
  );
};

export default InputComponent;