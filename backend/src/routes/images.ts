import express from 'express';
import { ImageGenerationService, ImageGenerationRequest } from '../services/ImageGenerationService.js';
import { APIResponse } from '../types/index.js';

const router = express.Router();

// Test image generation endpoint
router.post('/generate-illustration', async (req: express.Request, res: express.Response) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    const imageService = new ImageGenerationService();
    const request: ImageGenerationRequest = req.body;

    const image = await imageService.generateStoryIllustration(request);

    res.json({
      success: true,
      data: image
    });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate image'
    });
  }
});

// Generate character portrait endpoint
router.post('/generate-character-portrait', async (req: express.Request, res: express.Response) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    const { character } = req.body;
    if (!character) {
      return res.status(400).json({
        success: false,
        error: 'Character data is required'
      });
    }

    const imageService = new ImageGenerationService();
    const imageUrl = await imageService.generateCharacterPortrait(character);

    res.json({
      success: true,
      data: {
        imageUrl,
        character
      }
    });

  } catch (error) {
    console.error('Character portrait generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate character portrait'
    });
  }
});

// Generate character-consistent illustration with image reference (UPGRADED)
// Now supports GPT-image-1 with actual image input when available
router.post('/generate-character-consistent-illustration', async (req, res) => {
  try {
    const { character, sceneDescription, pageNumber, storyTitle } = req.body;

    if (!character || !sceneDescription) {
      return res.status(400).json({
        success: false,
        error: 'Character and scene description are required'
      });
    }

    const imageService = new ImageGenerationService();
    
    // Use new hybrid method that tries GPT-image-1 first, falls back to DALL-E 3
    const result = await imageService.generateCharacterIllustrationHybrid(
      character,
      sceneDescription,
      storyTitle || 'Story',
      pageNumber
    );

    res.json(result);

  } catch (error: any) {
    console.error('Character-consistent illustration generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate character illustration'
    });
  }
});

// New endpoint: Generate with explicit GPT-image-1 model (when available)
router.post('/generate-with-gpt-image-1', async (req, res) => {
  try {
    const { character, sceneDescription, pageNumber, storyTitle } = req.body;

    if (!character || !sceneDescription) {
      return res.status(400).json({
        success: false,
        error: 'Character and scene description are required'
      });
    }

    if (!character.imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Character image is required for GPT-image-1 generation'
      });
    }

    const imageService = new ImageGenerationService();
    
    if (!imageService.isGPTImage1Available()) {
      return res.status(503).json({
        success: false,
        error: 'GPT-image-1 is not configured or available. Please check Azure OpenAI configuration.'
      });
    }

    // Get character image path
    const fs = require('fs');
    const path = require('path');
    const imagePath = path.join(process.cwd(), 'uploads', path.basename(character.imageUrl));
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Character image file not found'
      });
    }
    
    const result = await imageService.generateWithImageReference(
      character,
      sceneDescription,
      imagePath,
      storyTitle,
      pageNumber
    );

    res.json(result);

  } catch (error: any) {
    console.error('GPT-image-1 generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate GPT-image-1 illustration'
    });
  }
});

// Analyze character image endpoint
router.post('/analyze-character-image', async (req: express.Request, res: express.Response) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Image URL is required'
      });
    }

    const imageService = new ImageGenerationService();
    const analysis = await imageService.analyzeCharacterImage(imageUrl);

    res.json({
      success: true,
      data: {
        analysis,
        imageUrl
      }
    });

  } catch (error) {
    console.error('Character image analysis error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze character image'
    });
  }
});

export default router;