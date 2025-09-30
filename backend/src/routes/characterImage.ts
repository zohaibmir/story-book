import { Router } from 'express';
import { ImageGenerationService } from '../services/ImageGenerationService.js';
import { Character } from '../types/index.js';

const router = Router();

/**
 * POST /api/character/analyze-image
 * Body: { imageUrl: string; traits?: string[] }
 */
router.post('/analyze-image', async (req, res) => {
  try {
    const { imageUrl, traits = [] } = req.body as { imageUrl?: string; traits?: string[] };
    if (!imageUrl) {
      return res.status(400).json({ success: false, error: 'imageUrl required' });
    }
    const service = new ImageGenerationService();
    const data = await service.analyzeCharacterImageBase64(imageUrl, traits);
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Image analysis failed', details: e.message });
  }
});

export default router;
