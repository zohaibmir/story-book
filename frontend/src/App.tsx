import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import Header from './components/Header';
import CharacterForm from './components/CharacterForm';
import StoryGenerator from './components/StoryGenerator';
import StoryDisplay from './components/StoryDisplay';
import { Character, GenerateStoryResponse } from './types';
import './App.css';

type AppStep = 'character' | 'prompt' | 'story';

const App: React.FC = () => {
  const [character, setCharacter] = useState<Character | null>(null);
  const [story, setStory] = useState<GenerateStoryResponse | null>(null);
  const [currentStep, setCurrentStep] = useState<AppStep>('character');

  const handleCharacterSubmit = useCallback((characterData: Character) => {
    setCharacter(characterData);
    setCurrentStep('prompt');
  }, []);

  const handleStoryGenerated = useCallback((storyData: GenerateStoryResponse) => {
    console.log('App received story data:', storyData);
    setStory(storyData);
    setCurrentStep('story');
  }, []);

  const handleReset = useCallback(() => {
    setCharacter(null);
    setStory(null);
    setCurrentStep('character');
  }, []);

  const handleBackToCharacter = useCallback(() => {
    setCurrentStep('character');
  }, []);

  return (
    <Router>
      <div className="App">
        <Header />
        <main className="main-content">
          <div className="fade-in">
            {currentStep === 'character' && (
              <CharacterForm onSubmit={handleCharacterSubmit} />
            )}
            
            {currentStep === 'prompt' && character && (
              <StoryGenerator 
                character={character} 
                onStoryGenerated={handleStoryGenerated}
                onBack={handleBackToCharacter}
              />
            )}
            
            {currentStep === 'story' && story && character && (
              <StoryDisplay 
                story={story} 
                character={character}
                onNewStory={handleReset}
              />
            )}
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;