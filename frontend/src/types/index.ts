// Domain Types - Core business entities
export interface Character {
  name: string;
  age: number;
  personality: string[];
  interests: string[];
  sisters?: Sister[];
  personalMessage?: string;
  imageUrl?: string;
}

export interface Sister {
  name: string;
  traits: string;
  favoriteThings?: string[];
}

export interface Story {
  id?: string;
  title: string;
  content: string;
  character: Character;
  themes: string;
  setting: string;
  generatedAt: string;
  wordCount: number;
}

export interface StoryPage {
  pageNumber: number;
  title: string;
  content: string;
  visualDescription: string;
}

// Request/Response Types
export interface GenerateStoryRequest {
  character: Character;
  prompt: string;
  themes?: string;
  setting?: string;
  characterDescriptor?: string; // optional descriptor derived from image analysis
  generateIllustrations?: boolean; // request backend to attempt illustrations
}

export interface GenerateStoryResponse {
  success: boolean;
  story: string;
  character: Character;
  metadata: {
    generatedAt: string;
    model: string;
    wordCount: number;
  };
  illustrations?: StoryIllustration[];
}

export interface StoryIllustration {
  url?: string; // DALL-E 3 returns url
  b64_json?: string; // GPT-image-1 might return base64
  description: string;
  pageNumber: number;
  model?: string;
  characterReferenced?: boolean;
}

export interface SuggestionsRequest {
  character: Character;
}

export interface SuggestionsResponse {
  success: boolean;
  suggestions: string[];
}

// API Error Types
export interface APIError {
  error: string;
  details?: string;
}

// Form Types
export interface CharacterFormData {
  name: string;
  age: string;
  personality: string;
  interests: string;
  sisters: string;
  personalMessage?: string;
}

// Component Props Types
export interface StepProps {
  onNext?: () => void;
  onBack?: () => void;
}

// Service Types
export interface FileUploadResult {
  message: string;
  filename: string;
  path: string;
}

// Image Analysis Types
export interface CharacterImageAnalysis {
  success: boolean;
  data?: {
    descriptor: string;
    hash: string;
    model: string;
    confidence: number;
    cached: boolean;
  };
  error?: string;
}