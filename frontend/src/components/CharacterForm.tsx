import React, { useState, useCallback } from 'react';
import { Character, CharacterFormData } from '../types';
import { apiService } from '../services/apiService';
import './CharacterForm.css';

interface CharacterFormProps {
  onSubmit: (character: Character) => void;
}

const CharacterForm: React.FC<CharacterFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<CharacterFormData>({
    name: '',
    age: '',
    personality: '',
    interests: '',
    sisters: '',
    personalMessage: ''
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Partial<CharacterFormData>>({});

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name as keyof CharacterFormData]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  }, [errors]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (JPEG, PNG, GIF)');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Partial<CharacterFormData> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.age.trim()) {
      newErrors.age = 'Age is required';
    } else {
      const age = parseInt(formData.age);
      if (isNaN(age) || age < 1 || age > 18) {
        newErrors.age = 'Age must be between 1 and 18';
      }
    }
    
    if (!formData.personality.trim()) {
      newErrors.personality = 'At least one personality trait is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setUploading(true);
    
    try {
      let imageUrl = '';
      
      // Upload file if selected
      if (selectedFile) {
        const uploadResult = await apiService.uploadFile(selectedFile);
        imageUrl = uploadResult.path;
      }

      // Parse form data into character object
      const character: Character = {
        name: formData.name.trim(),
        age: parseInt(formData.age),
        personality: formData.personality.split(',').map(p => p.trim()).filter(p => p),
        interests: formData.interests.split(',').map(i => i.trim()).filter(i => i),
        personalMessage: formData.personalMessage?.trim() || undefined,
        imageUrl: imageUrl || undefined,
        sisters: formData.sisters ? 
          formData.sisters.split(',').map(s => {
            const parts = s.split('(');
            return {
              name: parts[0].trim(),
              traits: parts[1] ? parts[1].replace(')', '').trim() : ''
            };
          }).filter(s => s.name) : undefined
      };

      onSubmit(character);
    } catch (error) {
      console.error('Form submission error:', error);
      alert('Failed to submit form. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="character-form-container">
      <div className="character-form-card">
        <h2 className="form-title">Discover Your Inner Hero</h2>
        <p className="form-subtitle">Let's explore what makes you special, brave, and unique</p>
        
        <form onSubmit={handleSubmit} className="character-form">
          <div className="form-group half-width">
            <label htmlFor="name" className="form-label">Character Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="e.g., Loulia"
              disabled={uploading}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group half-width">
            <label htmlFor="age" className="form-label">Age *</label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age}
              onChange={handleInputChange}
              className={`form-input ${errors.age ? 'error' : ''}`}
              placeholder="e.g., 10"
              min="1"
              max="18"
              disabled={uploading}
            />
            {errors.age && <span className="error-message">{errors.age}</span>}
          </div>

          <div className="form-group full-width">
            <label htmlFor="personality" className="form-label">Personality Traits *</label>
            <input
              type="text"
              id="personality"
              name="personality"
              value={formData.personality}
              onChange={handleInputChange}
              className={`form-input ${errors.personality ? 'error' : ''}`}
              placeholder="e.g., Brave, Curious, Loving older sister, Bookworm"
              disabled={uploading}
            />
            {errors.personality && <span className="error-message">{errors.personality}</span>}
            <small className="form-hint">Separate multiple traits with commas</small>
          </div>

          <div className="form-group half-width">
            <label htmlFor="interests" className="form-label">Interests & Hobbies</label>
            <input
              type="text"
              id="interests"
              name="interests"
              value={formData.interests}
              onChange={handleInputChange}
              className="form-input"
              placeholder="e.g., Nintendo Switch, Reading, Adventure games"
              disabled={uploading}
            />
            <small className="form-hint">Separate multiple interests with commas</small>
          </div>

          <div className="form-group half-width">
            <label htmlFor="sisters" className="form-label">Sisters/Siblings</label>
            <input
              type="text"
              id="sisters"
              name="sisters"
              value={formData.sisters}
              onChange={handleInputChange}
              className="form-input"
              placeholder="e.g., Sara (calm, wise), Aya (fun, energetic)"
              disabled={uploading}
            />
            <small className="form-hint">Format: Name (traits), Name (traits)</small>
          </div>

          <div className="form-group half-width">
            <label htmlFor="character-image" className="form-label">Character Image</label>
            <div className="file-upload-area">
              <input
                type="file"
                id="character-image"
                name="character-image"
                onChange={handleFileChange}
                className="file-input-hidden"
                accept="image/*"
                disabled={uploading}
              />
              <label htmlFor="character-image" className="file-upload-label">
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Character preview" className="preview-image" />
                    <div className="upload-overlay">
                      <span>📸 Click to change image</span>
                    </div>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <span className="upload-icon">📸</span>
                    <span>Click to upload character image</span>
                    <small>JPEG, PNG, GIF (max 5MB)</small>
                  </div>
                )}
              </label>
            </div>
            {selectedFile && (
              <small className="form-hint">Selected: {selectedFile.name}</small>
            )}
          </div>

          <div className="form-group full-width">
            <label htmlFor="personalMessage" className="form-label">Personal Message</label>
            <textarea
              id="personalMessage"
              name="personalMessage"
              value={formData.personalMessage}
              onChange={handleInputChange}
              className="form-textarea"
              placeholder="A special message to include in the story..."
              rows={3}
              disabled={uploading}
            />
          </div>

          <button 
            type="submit" 
            className="submit-button full-width"
            disabled={uploading}
          >
            {uploading ? (
              <>
                <span className="spinner"></span>
                Creating Character...
              </>
            ) : (
              'Create Character'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CharacterForm;