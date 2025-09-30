import React from 'react';
import './Header.css';

const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">
          <span className="header-icon">📚</span>
          AI Storybook Creator
        </h1>
        <p className="header-subtitle">
          Where every child becomes the hero of their own magical adventure
        </p>
      </div>
    </header>
  );
};

export default Header;