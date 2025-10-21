import React, { useEffect, useRef } from 'react';
import './SliderComponent.css';

/**
 * 统一的滑动条组件
 * 支持自定义范围、步长、标签和描述
 */
const SliderComponent = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  description,
  className = '',
  showValue = true,
  valueFormatter = (val) => val,
  type = 'default' // 'default' | 'parameter' | 'context'
}) => {
  const sliderRef = useRef(null);

  // 更新滑动条进度样式
  useEffect(() => {
    const updateSliderProgress = () => {
      if (sliderRef.current) {
        const slider = sliderRef.current;
        const progress = ((value - min) / (max - min)) * 100;
        slider.style.setProperty('--slider-progress', `${progress}%`);
      }
    };

    updateSliderProgress();
  }, [value, min, max]);

  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    if (onChange) {
      onChange(newValue);
    }
  };

  return (
    <div className={`slider-component ${className} slider-${type}`}>
      {label && (
        <label className="slider-label">
          {label}
        </label>
      )}
      
      <div className="slider-container">
        <input
          ref={sliderRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          className="slider-input"
        />
        
        {showValue && (
          <span className="slider-value">
            {valueFormatter(value)}
          </span>
        )}
      </div>
      
      {description && (
        <div className="slider-description">
          {description}
        </div>
      )}
    </div>
  );
};

export default SliderComponent;