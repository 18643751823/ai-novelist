import React, { useEffect, useState } from 'react';
import './BackgroundImage.css';

// 导入背景图片
import cloudImage from '../../assets/卷云.png';
import thunderImage from '../../assets/雷云.png';
import candleImage from '../../assets/烛火.png';

function BackgroundImage() {
  const [cloudRotation, setCloudRotation] = useState(0);
  const [thunderRotation, setThunderRotation] = useState(0);
  const [candleOffset, setCandleOffset] = useState(0);

  useEffect(() => {
    console.log('背景图组件加载完成');
    console.log('卷云图片路径:', cloudImage);
    console.log('雷云图片路径:', thunderImage);
    console.log('烛火图片路径:', candleImage);

    // 设置旋转动画
    const cloudInterval = setInterval(() => {
      setCloudRotation(prev => (prev - 1) % 360);
    }, 50); // 每50毫秒旋转1度，20秒完成一圈

    const thunderInterval = setInterval(() => {
      setThunderRotation(prev => (prev + 1) % 360);
    }, 40); // 每40毫秒旋转1度，16秒完成一圈

    const candleInterval = setInterval(() => {
      setCandleOffset(prev => {
        const time = Date.now() / 1000;
        return Math.sin(time * 2) * 2; // 减小飘动幅度为2px
      });
    }, 50);

    return () => {
      clearInterval(cloudInterval);
      clearInterval(thunderInterval);
      clearInterval(candleInterval);
    };
  }, []);

  return (
    <div className="background-container">
      {/* 卷云层 - 逆时针旋转 */}
      <div
        className="background-layer cloud-layer"
        style={{
          backgroundImage: `url(${cloudImage})`,
          transform: `rotate(${cloudRotation}deg)`,
          zIndex: 1
        }}
      />
      
      {/* 雷云层 - 顺时针旋转 */}
      <div
        className="background-layer thunder-layer"
        style={{
          backgroundImage: `url(${thunderImage})`,
          transform: `rotate(${thunderRotation}deg)`,
          zIndex: 2
        }}
      />
      
      {/* 烛火层 - 轻微浮动效果 */}
      <div
        className="background-layer candle-layer"
        style={{
          backgroundImage: `url(${candleImage})`,
          transform: `translateY(${candleOffset}px)`,
          zIndex: 3
        }}
      />
    </div>
  );
}

export default BackgroundImage;