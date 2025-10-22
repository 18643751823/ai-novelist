import React from 'react';

// 提问卡片组件
const QuestionCard = ({ 
  questionCard, 
  onUserQuestionResponse 
}) => {
  if (!questionCard) {
    return null;
  }

  const handleOptionClick = (option) => {
    onUserQuestionResponse(option, questionCard.toolCallId, true);
  };

  return (
    <div className="ai-question-card">
      <p className="ai-question-text">{questionCard.question}</p>
      <div className="ai-question-options">
        {questionCard.options && questionCard.options.length > 0 && (
          questionCard.options.map((option, index) => (
            <button
              key={index}
              className="ai-question-option-button"
              onClick={() => handleOptionClick(option)}
            >
              {option}
            </button>
          ))
        )}
      </div>
      {/* 输入区域已被移除，用户应使用主输入框进行回复 */}
    </div>
  );
};

export default QuestionCard;