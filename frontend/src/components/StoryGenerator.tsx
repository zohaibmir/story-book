import React, { useState, useCallback, useEffect } from 'react';
import { Character, GenerateStoryRequest } from '../types';
import { apiService } from '../services/apiService';
import './StoryGenerator.css';

interface StoryGeneratorProps {
  character: Character;
  onStoryGenerated: (story: any) => void;
  onBack: () => void;
}

const StoryGenerator: React.FC<StoryGeneratorProps> = ({ 
  character, 
  onStoryGenerated, 
  onBack 
}) => {
  const [prompt, setPrompt] = useState('');
  const [themes, setThemes] = useState('Adventure and friendship');
  const [setting, setSetting] = useState('Magical world');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [characterDescriptor, setCharacterDescriptor] = useState<string | null>(null);
  const [generateIllustrations, setGenerateIllustrations] = useState<boolean>(false);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const response = await apiService.getSuggestions(character);
      setSuggestions(response.suggestions || []);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, [character]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // Auto-analyze character image once when component mounts if image present
  useEffect(() => {
    const analyze = async () => {
      if (!character.imageUrl || characterDescriptor || analyzingImage) return;
      setAnalyzingImage(true);
      setAnalysisError(null);
      try {
        const personality = character.personality || [];
        const result = await apiService.analyzeCharacterImage(character.imageUrl, personality);
        if (result.success && result.data) {
          setCharacterDescriptor(result.data.descriptor);
        } else {
          setAnalysisError(result.error || 'Analysis failed');
        }
      } catch (err) {
        setAnalysisError('Analysis error');
      } finally {
        setAnalyzingImage(false);
      }
    };
    analyze();
  }, [character.imageUrl, character.personality, characterDescriptor, analyzingImage]);

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!prompt.trim()) {
      setError('Please enter a story prompt or select a suggestion');
      return;
    }

    setLoading(true);
    
    try {
      const request: GenerateStoryRequest = {
        character,
        prompt: prompt.trim(),
        themes,
        setting,
        ...(characterDescriptor ? { characterDescriptor } : {}),
        generateIllustrations
      };

      const response = await apiService.generateStory(request);
      console.log('Story generated successfully:', response);
      onStoryGenerated(response);
    } catch (err) {
      console.error('Failed to generate story:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate story');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="story-generator-container">
      <div className="story-generator-card">
        <div className="generator-header">
          <h2 className="generator-title">Choose {character.name}'s Heroic Journey</h2>
          <p className="generator-subtitle">
            What magical challenge will help {character.name} discover their inner strength?
          </p>
          
          {/* Character Summary */}
          <div className="character-preview">
            {character.imageUrl && (
              <img
                src={`http://localhost:5000${character.imageUrl}`}
                alt={character.name}
                className="character-avatar-small"
              />
            )}
            <div className="character-info-compact">
              <span><strong>{character.name}</strong>, age {character.age}</span>
              <span>{character.personality.join(', ')}</span>
              {character.imageUrl && (
                <span className="analysis-status">
                  {analyzingImage && 'Analyzing appearance...'}
                  {!analyzingImage && characterDescriptor && 'Appearance locked ✅'}
                  {!analyzingImage && !characterDescriptor && analysisError && 'Analysis failed'}
                </span>
              )}
            </div>
          </div>
          {characterDescriptor && (
            <div className="descriptor-preview">
              <details>
                <summary>Character Appearance Descriptor (used for consistency)</summary>
                <p>{characterDescriptor}</p>
              </details>
            </div>
          )}

          <div className="form-section">
            <label className="illustrations-toggle">
              <input
                type="checkbox"
                checked={generateIllustrations}
                onChange={(e) => setGenerateIllustrations(e.target.checked)}
                disabled={loading}
              />
              Generate up to 3 illustrations (experimental)
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="generator-form">
          {/* Story Prompt Section */}
          <div className="form-section">
            <h3 className="section-title">Story Prompt</h3>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`What heroic challenge will help ${character.name} grow stronger? Describe the magical adventure, mystery to solve, or brave quest...`}
              className="prompt-textarea"
              rows={4}
              disabled={loading}
            />
          </div>

          {/* Suggestions Section */}
          <div className="form-section">
            <h3 className="section-title">
              Story Suggestions
              {loadingSuggestions && <span className="loading-indicator">Loading...</span>}
            </h3>
            
            {suggestions.length > 0 ? (
              <div className="suggestions-grid">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`suggestion-card ${prompt === suggestion ? 'selected' : ''}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={loading}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : !loadingSuggestions && (
              <p className="no-suggestions">No suggestions available</p>
            )}
          </div>

          {/* Themes and Setting */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="themes" className="form-label">What Will They Learn?</label>
              <input
                type="text"
                id="themes"
                value={themes}
                onChange={(e) => setThemes(e.target.value)}
                className="form-input"
                placeholder="e.g., Courage, kindness, family bonds, believing in yourself"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="setting" className="form-label">Setting</label>
              <input
                type="text"
                id="setting"
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                className="form-input"
                placeholder="e.g., Magical world"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onBack}
              className="back-button"
              disabled={loading}
            >
              ← Back to Character
            </button>

            <button
              type="submit"
              className="generate-button"
              disabled={loading || !prompt.trim()}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Generating Story...
                </>
              ) : (
                '🌟 Create Magical Adventure'
              )}
            </button>
          </div>
        </form>

        {loading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p>Creating your magical story...</p>
              <small>This may take up to 30 seconds</small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryGenerator;