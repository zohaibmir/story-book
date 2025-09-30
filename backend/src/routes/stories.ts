import express from 'express';
import { GenerateStoryRequest, SuggestionsRequest, APIResponse, StoryResponse, SuggestionsResponse } from '../types/index.js';
import { illustrationJobManager } from '../services/IllustrationJobManager.js';
import { OpenAIService } from '../services/OpenAIService.js';

const router = express.Router();

// Lazy initialization function for OpenAI service
const getOpenAIService = (): OpenAIService => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not found in environment variables');
  }
  return new OpenAIService(apiKey);
};

// Generate story endpoint with optional illustrations
router.post('/generate', async (req: GenerateStoryRequest, res: express.Response<APIResponse<StoryResponse>>) => {
  try {
  const { character, prompt, themes, setting, characterDescriptor, generateIllustrations } = req.body;

    if (!character || !prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Character and prompt are required' 
      });
    }

    const openAIService = getOpenAIService();
  const story = await openAIService.generateStory(character, prompt, themes, setting, characterDescriptor);

    let illustrations: any[] = [];
    let illustrationJobId: string | undefined;
    const asyncMode = process.env.ASYNC_ILLUSTRATIONS === 'true';

    if (generateIllustrations) {
      const storyScenes = extractStoryScenes(story);
      if (asyncMode) {
        // Enqueue job and return immediately
        const job = illustrationJobManager.enqueue({
          storyId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          character,
          storyTitle: `${character.name}'s Adventure`,
          scenes: storyScenes.slice(0, 3)
        });
        illustrationJobId = job.id;
      } else {
        try {
          const { ImageGenerationService } = await import('../services/ImageGenerationService.js');
          const imageService = new ImageGenerationService();
          for (const scene of storyScenes.slice(0, 3)) {
            try {
              // Use hybrid method now that it's implemented
              const hybrid: any = await imageService.generateCharacterIllustrationHybrid(
                character,
                scene.description,
                `${character.name}'s Adventure`,
                scene.pageNumber
              );
              if (hybrid && typeof hybrid === 'object') {
                if ('success' in hybrid && hybrid.success && hybrid.data) {
                  illustrations.push({ ...hybrid.data });
                } else if ('url' in hybrid) {
                  illustrations.push({ ...hybrid, model: hybrid.model || 'dall-e-3' });
                }
              }
              await new Promise(r => setTimeout(r, 1500));
            } catch (imgErr) {
              console.error('Failed to generate illustration:', imgErr);
            }
          }
        } catch (err) {
          console.error('Illustration generation failed:', err);
        }
      }
    }

    const response: StoryResponse = {
      story,
      character,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: 'gpt-4o',
        wordCount: story.split(' ').length,
        ...(characterDescriptor ? { characterDescriptorUsed: true } : {}),
        ...(illustrationJobId ? { illustrationJobId, illustrationsPending: true } : {}),
        ...(illustrations.length > 0 ? { illustrationsPending: false } : {})
      },
      ...(illustrations.length > 0 && { illustrations })
    };

    res.json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Story generation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate story';
    
    if (errorMessage.includes('quota')) {
      return res.status(402).json({ 
        success: false, 
        error: errorMessage 
      });
    }
    
    if (errorMessage.includes('invalid_api_key')) {
      return res.status(401).json({ 
        success: false, 
        error: errorMessage 
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Failed to generate story',
      details: errorMessage
    });
  }
});

// Helper function to extract key scenes from story text
function extractStoryScenes(story: string): { description: string; pageNumber: number }[] {
  const scenes: { description: string; pageNumber: number }[] = [];
  
  // Simple extraction based on story structure
  const lines = story.split('\n').filter(line => line.trim());
  let pageNumber = 1;
  
  for (const line of lines) {
    if (line.includes('**Page') || line.includes('*Illustration Description*')) {
      // Extract illustration descriptions
      const match = line.match(/\*Illustration Description\*:?\s*(.+)/i);
      if (match) {
        scenes.push({
          description: match[1].trim(),
          pageNumber: pageNumber++
        });
      }
    }
  }
  
  // If no explicit illustrations found, create some based on story content
  if (scenes.length === 0) {
    const storyParts = story.split('\n\n').filter(part => part.trim().length > 50);
    scenes.push(
      {
        description: `Opening scene showing the main character in their familiar environment`,
        pageNumber: 1
      },
      {
        description: `The character discovering the magical adventure that awaits them`,
        pageNumber: 2
      },
      {
        description: `The climactic moment where the character shows their bravery and strength`,
        pageNumber: 3
      }
    );
  }
  
  return scenes.slice(0, 3); // Limit to 3 scenes
}

// Get story suggestions endpoint
router.post('/suggestions', async (req: SuggestionsRequest, res: express.Response<APIResponse<SuggestionsResponse>>) => {
  try {
    const { character } = req.body;

    if (!character) {
      return res.status(400).json({ 
        success: false, 
        error: 'Character information is required' 
      });
    }

    const openAIService = getOpenAIService();
    const suggestions = await openAIService.generateSuggestions(character);

    res.json({
      success: true,
      data: { suggestions }
    });

  } catch (error) {
    console.error('Suggestions generation error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate suggestions';
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate suggestions',
      details: errorMessage
    });
  }
});

export default router;

// --- Async Illustration Job Endpoints ---
router.get('/illustrations/job/:id', (req, res: express.Response) => {
  if (process.env.ASYNC_ILLUSTRATIONS !== 'true') {
    return res.status(400).json({ success: false, error: 'Async illustrations disabled' });
  }
  const job = illustrationJobManager.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
  res.json({ success: true, data: job });
});

router.get('/illustrations/jobs', (req, res: express.Response) => {
  if (process.env.ASYNC_ILLUSTRATIONS !== 'true') {
    return res.status(400).json({ success: false, error: 'Async illustrations disabled' });
  }
  const jobs = illustrationJobManager.list();
  res.json({ success: true, data: jobs });
});