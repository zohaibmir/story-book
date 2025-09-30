import React, { useState } from 'react';
import { Character, GenerateStoryResponse, StoryIllustration } from '../types';
import './StoryDisplay.css';

interface StoryDisplayProps {
  story: GenerateStoryResponse;
  character: Character;
  onNewStory: () => void;
}

const StoryDisplay: React.FC<StoryDisplayProps> = ({ 
  story, 
  character, 
  onNewStory 
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  console.log('StoryDisplay rendered with:', { story, character });

  const formatStoryContent = (content: string) => {
    // Split content into paragraphs and format for better readability
    return content
      .split('\n')
      .filter(line => line.trim())
      .map((paragraph, index) => {
        // Check if it's a title/heading (typically starts with numbers or is in caps)
        if (paragraph.match(/^(Spread|Cover|Page|\d+\.)/i) || paragraph === paragraph.toUpperCase()) {
          return (
            <h3 key={index} className="story-heading">
              {paragraph}
            </h3>
          );
        }
        
        // Check if it's a visual description (typically contains "Visual:" or "Description:")
        if (paragraph.toLowerCase().includes('visual:') || paragraph.toLowerCase().includes('description:')) {
          return (
            <div key={index} className="visual-description">
              <em>{paragraph}</em>
            </div>
          );
        }
        
        // Regular paragraph
        return (
          <p key={index} className="story-paragraph">
            {paragraph}
          </p>
        );
      });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([story.story], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${character.name}-story.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className={`story-display-container ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="story-display-card">
        {/* Header */}
        <div className="story-header">
          <div className="story-info">
            <h2 className="story-title">
              🌟 {character.name}'s Heroic Adventure
            </h2>
            <div className="story-meta">
              <span className="meta-item">
                📅 {new Date(story.metadata.generatedAt).toLocaleDateString()}
              </span>
              <span className="meta-item">
                📝 {story.metadata.wordCount} words
              </span>
              <span className="meta-item">
                🤖 {story.metadata.model}
              </span>
            </div>
          </div>
          
          <div className="story-actions">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="action-button fullscreen-button"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? '📋' : '🔍'}
            </button>
            <button
              onClick={handlePrint}
              className="action-button print-button"
              title="Print story"
            >
              🖨️
            </button>
            <button
              onClick={handleDownload}
              className="action-button download-button"
              title="Download story"
            >
              💾
            </button>
          </div>
        </div>

        {/* Character Summary */}
        <div className="character-summary">
          <h4>Character Profile:</h4>
          <div className="character-details">
            {character.imageUrl && (
              <div className="character-image">
                <img 
                  src={`http://localhost:5000${character.imageUrl}`} 
                  alt={character.name}
                  className="character-avatar"
                />
              </div>
            )}
            <div className="character-info">
              <span><strong>Name:</strong> {character.name}</span>
              <span><strong>Age:</strong> {character.age}</span>
              <span><strong>Personality:</strong> {character.personality.join(', ')}</span>
              {character.interests.length > 0 && (
                <span><strong>Interests:</strong> {character.interests.join(', ')}</span>
              )}
              {character.sisters && character.sisters.length > 0 && (
                <span><strong>Sisters:</strong> {character.sisters.map(s => `${s.name} (${s.traits})`).join(', ')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Illustrations (if any) */}
        {story.illustrations && story.illustrations.length > 0 && (
          <div className="illustrations-section">
            <h3 className="illustrations-title">Illustrations</h3>
            <div className="illustrations-grid">
              {story.illustrations.map((ill: StoryIllustration, idx: number) => {
                const imgAlt = ill.description || `Story illustration ${idx+1}`;
                let src: string | undefined = ill.url;
                if (!src && ill.b64_json) {
                  src = `data:image/png;base64,${ill.b64_json}`;
                }
                return (
                  <figure key={idx} className="illustration-card">
                    {src ? (
                      <img src={src} alt={imgAlt} loading="lazy" />
                    ) : (
                      <div className="illustration-placeholder">No image</div>
                    )}
                    <figcaption>
                      <strong>Page {ill.pageNumber}</strong>: {ill.description}
                      {ill.model && <span className="illustration-meta"> ({ill.model}{ill.characterReferenced ? ' +ref' : ''})</span>}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        )}

        {/* Story Content */}
        <div className="story-content">
          <div className="story-text">
            {formatStoryContent(story.story)}
          </div>
        </div>

        {/* Personal Message */}
        {character.personalMessage && (
          <div className="personal-message">
            <h4>💝 Personal Message:</h4>
            <p className="message-content">
              {character.personalMessage}
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="story-footer">
          <button
            onClick={onNewStory}
            className="new-story-button"
          >
            📚 Create New Story
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryDisplay;