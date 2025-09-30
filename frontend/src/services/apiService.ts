import axios from 'axios';
import { 
  Character, 
  GenerateStoryRequest, 
  GenerateStoryResponse, 
  SuggestionsRequest, 
  SuggestionsResponse,
  FileUploadResult,
  CharacterImageAnalysis 
} from '../types/index.js';

const API_BASE_URL = '/api';

class ApiService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 190000, // Increased to 90s to accommodate story + illustration generation latency
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        throw error;
      }
    );
  }

  async generateStory(request: GenerateStoryRequest): Promise<GenerateStoryResponse> {
    try {
      const response = await this.axiosInstance.post('/stories/generate', request);
      
      // Backend returns { success: true, data: { story, character, metadata } }
      // Frontend expects { success: true, story, character, metadata }
      if (response.data.success && response.data.data) {
        return {
          success: true,
          story: response.data.data.story,
          character: response.data.data.character,
          metadata: response.data.data.metadata,
          illustrations: response.data.data.illustrations
        };
      } else {
        throw new Error(response.data.error || 'Failed to generate story');
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to generate story');
    }
  }

  async analyzeCharacterImage(imageUrl: string, traits: string[] = []): Promise<CharacterImageAnalysis> {
    try {
      const response = await this.axiosInstance.post('/character/analyze-image', {
        imageUrl,
        traits
      });
      return response.data;
    } catch (error) {
      console.error('Character image analysis failed:', error);
      return { success: false, error: 'Character image analysis failed' };
    }
  }

  async getSuggestions(character: Character): Promise<SuggestionsResponse> {
    try {
      const request: SuggestionsRequest = { character };
      const response = await this.axiosInstance.post('/stories/suggestions', request);
      
      // Backend returns { success: true, data: { suggestions } }
      // Frontend expects { success: true, suggestions }
      if (response.data.success && response.data.data) {
        return {
          success: true,
          suggestions: response.data.data.suggestions
        };
      } else {
        throw new Error(response.data.error || 'Failed to get suggestions');
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to get suggestions');
    }
  }

  async uploadFile(file: File): Promise<FileUploadResult> {
    try {
      const formData = new FormData();
      formData.append('character-image', file);

      const response = await this.axiosInstance.post<FileUploadResult>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Failed to upload file');
    }
  }

  async checkHealth(): Promise<{ status: string; message: string }> {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error, 'Health check failed');
    }
  }

  private handleError(error: any, defaultMessage: string): Error {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error status
        const message = error.response.data?.error || defaultMessage;
        return new Error(message);
      } else if (error.request) {
        // Network error
        return new Error('Network error. Please check your connection.');
      }
    }
    
    return new Error(defaultMessage);
  }
}

// Singleton instance
export const apiService = new ApiService();
export default apiService;