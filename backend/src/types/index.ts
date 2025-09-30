import { Request, Response } from 'express';

// Domain Types
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

// Request Types
export interface GenerateStoryRequest extends Request {
  body: {
    character: Character;
    prompt: string;
    themes?: string;
    setting?: string;
    // Optional: pass a pre-computed character descriptor derived from image analysis
    characterDescriptor?: string;
    // Optional flag from client to request illustration generation
    generateIllustrations?: boolean;
    // Future: client-provided storyId (optional) to correlate async jobs
    storyId?: string;
  };
}

export interface SuggestionsRequest extends Request {
  body: {
    character: Character;
  };
}

// Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface StoryResponse {
  story: string;
  character: Character;
  metadata: {
    generatedAt: string;
    model: string;
    wordCount: number;
    illustrationJobId?: string;
    illustrationsPending?: boolean;
    characterDescriptorUsed?: boolean;
  };
  illustrations?: any[]; // kept broad due to mixed sync/async shapes
}

export interface SuggestionsResponse {
  suggestions: string[];
}

// Service Interfaces (SOLID - Interface Segregation Principle)
export interface IStoryGenerator {
  generateStory(character: Character, prompt: string, themes?: string, setting?: string): Promise<string>;
}

export interface ISuggestionGenerator {
  generateSuggestions(character: Character): Promise<string[]>;
}

export interface IFileUploadService {
  uploadFile(file: Express.Multer.File): Promise<string>;
  deleteFile(filename: string): Promise<void>;
}

// OpenAI Types
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// Error Types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}