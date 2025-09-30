import OpenAI from 'openai';
import { Character } from '../types/index.js';

export interface StoryImage {
  url: string;
  description: string;
  pageNumber: number;
}

export interface ImageGenerationRequest {
  character: Character;
  sceneDescription: string;
  pageNumber: number;
  storyTitle: string;
}

export class ImageGenerationService {
  private openai: OpenAI | null = null;
  private azureOpenAI: OpenAI | null = null;
  // cache for analyzed descriptors
  private descriptorCache: Map<string, {
    hash: string; descriptor: string; model: string; confidence: number; cached: boolean;
  }> = new Map();

  constructor() {
    // Defer actual OpenAI initialization until first use (lazy) to avoid crashing on startup
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      try {
        const { AzureOpenAI } = require('openai');
        this.azureOpenAI = new AzureOpenAI({
          endpoint: process.env.AZURE_OPENAI_ENDPOINT,
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
            deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-image-1',
        });
      } catch (e) {
        console.warn('Azure OpenAI initialization failed (continuing with standard OpenAI):', (e as Error).message);
      }
    }
  }

  // --- Persistence Helpers ---
  private shouldSave(): boolean {
    return process.env.SAVE_GENERATED_IMAGES === 'true';
  }

  private getSaveDir(): string {
    const dir = process.env.GENERATED_IMAGE_DIR || 'generated';
    return dir;
  }

  private ensureSaveDir(): string {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), this.getSaveDir());
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private async saveBufferToFile(buffer: Buffer, baseName: string, extPreferred?: string): Promise<{ localPath: string; publicUrl: string; }> {
    const fs = require('fs');
    const path = require('path');
    const ext = (extPreferred || process.env.GENERATED_IMAGE_FORMAT || 'png').replace('.', '');
    const safe = baseName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const filename = `${safe}.${ext}`;
    const dir = this.ensureSaveDir();
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buffer);
    // After saving, attempt retention pruning asynchronously (do not await to avoid blocking response)
    this.pruneRetention().catch((e: any) => console.warn('Retention pruning failed:', e?.message));
    return { localPath: filePath, publicUrl: `/${this.getSaveDir()}/${filename}` };
  }

  private async downloadAndSave(url: string, baseName: string): Promise<{ localPath?: string; publicUrl?: string; }> {
    if (!this.shouldSave()) return {};
    try {
      const axios = require('axios');
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);
      return await this.saveBufferToFile(buffer, baseName, 'png');
    } catch (e) {
      console.warn('Failed to download image for saving:', (e as Error).message);
      return {};
    }
  }

  /**
   * Retention policy: enforce max files & max cumulative size if configured.
   * Runs best-effort; ignores errors silently (logged at warn level).
   */
  private async pruneRetention() {
    if (process.env.SAVE_GENERATED_IMAGES !== 'true') return;
    const maxFiles = Number(process.env.GENERATED_IMAGE_MAX_FILES || 0);
    const maxMB = Number(process.env.GENERATED_IMAGE_MAX_MB || 0);
    if (maxFiles === 0 && maxMB === 0) return; // nothing to enforce
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), this.getSaveDir());
    if (!fs.existsSync(dir)) return;
    const entries: { file: string; full: string; size: number; mtime: number }[] = fs.readdirSync(dir)
      .filter((f: string) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map((file: string) => {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        return { file, full, size: stat.size, mtime: stat.mtimeMs };
      })
  .sort((a: { mtime: number }, b: { mtime: number }) => a.mtime - b.mtime); // oldest first

    if (entries.length === 0) return;

    let totalSize = entries.reduce((acc, e) => acc + e.size, 0);
    const maxBytes = maxMB > 0 ? maxMB * 1024 * 1024 : 0;

    const toDelete: { full: string }[] = [];

    // Enforce file count
    if (maxFiles > 0 && entries.length > maxFiles) {
      const excess = entries.length - maxFiles;
      for (let i = 0; i < excess; i++) toDelete.push({ full: entries[i].full });
    }

    // Enforce size
    if (maxBytes > 0) {
      // Recompute list excluding already marked for deletion
      const remaining = entries.filter(e => !toDelete.some(d => d.full === e.full));
      for (const e of remaining) {
        if (totalSize <= maxBytes) break;
        toDelete.push({ full: e.full });
        totalSize -= e.size;
      }
    }

    // Deduplicate deletion list
    const unique = Array.from(new Set(toDelete.map(d => d.full)));
    for (const full of unique) {
      try { fs.unlinkSync(full); } catch (e: any) { console.warn('Failed pruning file', full, e?.message); }
    }
    if (unique.length > 0) {
      console.log(`🧹 Retention pruning removed ${unique.length} old generated image(s).`);
    }
  }

  private ensureOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key missing. Set OPENAI_API_KEY in environment.');
      }
      this.openai = new OpenAI({ apiKey });
    }
    return this.openai;
  }

  // --- Native GPT-Image-1 (non-Azure) helpers ---
  private isNativeGPTImage1Enabled(): boolean {
    return process.env.ENABLE_NATIVE_GPT_IMAGE1 === 'true' && !!process.env.OPENAI_API_KEY;
  }

  private async makeNativeImageEditRequest(imageBuffer: Buffer, prompt: string, filename: string) {
    const FormData = require('form-data');
    const axios = require('axios');
    const form = new FormData();
    form.append('image', imageBuffer, { filename: `${filename}.jpg`, contentType: 'image/jpeg' });
    form.append('prompt', prompt);
    form.append('model', 'gpt-image-1');
    form.append('size', '1024x1024');
    form.append('quality', 'high');
    form.append('n', '1');
    form.append('response_format', 'b64_json');

    const response = await axios.post('https://api.openai.com/v1/images/edits', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      timeout: Number(process.env.IMAGE_EDIT_TIMEOUT_MS || 120000)
    });
    return response.data.data[0];
  }

  /**
   * Native (non-Azure) GPT-image-1 image reference generation using OpenAI endpoint.
   * Returns base64 image data in same shape as Azure method for downstream compatibility.
   */
  async generateWithImageReferenceNative(
    character: Character,
    sceneDescription: string,
    imagePath: string,
    storyTitle?: string,
    pageNumber?: number
  ) {
    if (!this.isNativeGPTImage1Enabled()) {
      throw new Error('Native GPT-image-1 disabled or missing OPENAI_API_KEY');
    }
    try {
      const fs = require('fs');
      if (!fs.existsSync(imagePath)) throw new Error('Reference image not found for native GPT-image-1');
      const imageBuffer = fs.readFileSync(imagePath);

      const prompt = `Transform this character image into a new illustrated scene: ${sceneDescription}.\n` +
        `Maintain exact character appearance (facial features, hair, clothing style). Character name: ${character.name}, age ${character.age}.` +
        `${character.personality?.length ? ` Personality traits: ${character.personality.join(', ')}.` : ''}\n` +
        `Style: High-quality whimsical children's book illustration, vibrant, warm, magical atmosphere.` +
        `${storyTitle ? ` Story title: ${storyTitle}.` : ''}` +
        `${pageNumber ? ` Page number: ${pageNumber}.` : ''}`;

      const result = await this.makeNativeImageEditRequest(imageBuffer, prompt, character.name);

      let localUrl: string | undefined;
      if (this.shouldSave() && result.b64_json) {
        const buffer = Buffer.from(result.b64_json, 'base64');
        const saved = await this.saveBufferToFile(buffer, `gptimg-native-${Date.now()}-p${pageNumber || 1}`, 'png');
        localUrl = saved.publicUrl;
      }

      return {
        success: true,
        data: {
          b64_json: result.b64_json,
            description: sceneDescription,
            pageNumber: pageNumber || 1,
            model: 'gpt-image-1',
            characterReferenced: true,
            source: 'native',
            ...(localUrl ? { localUrl } : {})
        }
      };
    } catch (error: any) {
      console.error('Native GPT-image-1 generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate a story illustration using DALL-E 3 with character image reference
   */
  async generateStoryIllustration(request: ImageGenerationRequest): Promise<StoryImage> {
    const { character, sceneDescription, pageNumber, storyTitle } = request;

    // Create a detailed prompt that references the character's uploaded image
    const imagePrompt = this.buildImagePromptWithCharacterReference(character, sceneDescription, storyTitle);

    try {
  const client = this.ensureOpenAI();
  const response = await client.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
        style: "vivid", // More vibrant colors for children's books
      });

  const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      let saved: any = {};
      if (this.shouldSave()) {
        saved = await this.downloadAndSave(imageUrl, `story-${Date.now()}-p${pageNumber}`);
      }

      return {
        url: imageUrl,
        description: sceneDescription,
        pageNumber: pageNumber,
        ...(saved.publicUrl ? { localUrl: saved.publicUrl } : {})
      };

    } catch (error) {
      throw this.handleImageGenerationError(error);
    }
  }

  /**
   * Generate character portrait using DALL-E 3
   */
  async generateCharacterPortrait(character: Character): Promise<string> {
    const portraitPrompt = this.buildCharacterPortraitPrompt(character);

    try {
  const client = this.ensureOpenAI();
  const response = await client.images.generate({
        model: "dall-e-3",
        prompt: portraitPrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
        style: "natural",
      });

  const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      return imageUrl;

    } catch (error) {
      throw this.handleImageGenerationError(error);
    }
  }

  /**
   * Generate character-consistent story illustration 
   * Since DALL-E 3 doesn't support image input, we use detailed text descriptions
   * and consistent character naming for better coherence across illustrations
   */
  async generateCharacterConsistentIllustration(
    request: ImageGenerationRequest,
    characterImageUrl: string
  ): Promise<StoryImage> {
    const { character, sceneDescription, pageNumber, storyTitle } = request;

    // Create a detailed character description based on available information
    const characterDescription = this.buildDetailedCharacterDescription(character);
    
    // Enhanced prompt for character consistency across illustrations
    const imagePrompt = `Create a beautiful children's book illustration in a whimsical, bright art style:

MAIN CHARACTER DETAILS:
${characterDescription}

SCENE: ${sceneDescription}

STORY CONTEXT: "${storyTitle}" - Page ${pageNumber}

CHARACTER CONSISTENCY REQUIREMENTS:
- Always show ${character.name} as the same person with consistent appearance
- Age ${character.age} child with the same hair, facial features, and style throughout
- Keep the character recognizable across all story illustrations
- Show ${character.name}'s personality (${character.personality?.join(', ')}) through body language

ART STYLE:
- Bright, cheerful children's book illustration style
- Professional quality suitable for publication
- Warm, inviting colors that appeal to children
- Clear, uncluttered composition focusing on the character
- Magic and wonder visible in the scene
- Safe, positive imagery appropriate for age ${character.age}

TECHNICAL REQUIREMENTS:
- Square format perfect for storybook pages
- High-quality detailed artwork
- Expressive character that children can relate to
- ${character.name} should be the clear hero/focus of the illustration`;

    try {
      console.log(`🎨 Generating character-consistent illustration for ${character.name} - Page ${pageNumber}`);
      
  const client = this.ensureOpenAI();
  const response = await client.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
        style: "vivid",
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      console.log(`✅ Generated illustration for ${character.name} - Page ${pageNumber}`);

      let saved: any = {};
      if (this.shouldSave()) {
        saved = await this.downloadAndSave(imageUrl, `consistent-${Date.now()}-p${pageNumber}`);
      }
      return {
        url: imageUrl,
        description: sceneDescription,
        pageNumber: pageNumber,
        ...(saved.publicUrl ? { localUrl: saved.publicUrl } : {})
      };

    } catch (error) {
      throw this.handleImageGenerationError(error);
    }
  }

  /**
   * Build detailed character description for consistent generation
   * This helps maintain character consistency across multiple illustrations
   */
  private buildDetailedCharacterDescription(character: Character): string {
    let description = `- Main character: ${character.name}, a ${character.age}-year-old child\n`;
    
    if (character.personality?.length) {
      description += `- Personality: ${character.personality.join(', ')} (show these traits through expression and posture)\n`;
    }
    
    if (character.interests?.length) {
      description += `- Interests: ${character.interests.join(', ')} (may influence clothing or accessories)\n`;
    }
    
    if (character.sisters?.length) {
      description += `- Family context: Has loving sisters (${character.sisters.map(s => s.name).join(', ')}) - shows family connection\n`;
    }

    // Add consistent visual guidelines
    description += `- Consistent visual traits: Same hairstyle, facial features, and general appearance in every illustration\n`;
    description += `- Age-appropriate appearance: Clearly shows a ${character.age}-year-old child\n`;
    description += `- Heroic presence: ${character.name} should look confident, capable, and ready for adventure\n`;
    
    return description;
  }

  /**
   * Generate multiple character-consistent illustrations for a complete story
   */
  async generateStoryIllustrations(
    character: Character,
    storyPages: { description: string; pageNumber: number }[],
    storyTitle: string
  ): Promise<StoryImage[]> {
    const illustrations: StoryImage[] = [];

    // Generate images sequentially to avoid rate limits
    for (const page of storyPages) {
      try {
        const image = character.imageUrl 
          ? await this.generateCharacterConsistentIllustration({
              character,
              sceneDescription: page.description,
              pageNumber: page.pageNumber,
              storyTitle
            }, character.imageUrl)
          : await this.generateStoryIllustration({
              character,
              sceneDescription: page.description,
              pageNumber: page.pageNumber,
              storyTitle
            });
        
        illustrations.push(image);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Failed to generate image for page ${page.pageNumber}:`, error);
        // Continue with other pages even if one fails
      }
    }

    return illustrations;
  }

  /**
   * Analyze uploaded character image to extract description
   */
  async analyzeCharacterImage(imagePath: string, publicImageUrl?: string): Promise<string> {
    try {
      const imageUrl = publicImageUrl || `http://localhost:5000${imagePath}`;
      
  const client = this.ensureOpenAI();
  const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this character image and provide a detailed physical description that could be used for consistent AI image generation. Focus on facial features, hair, clothing style, age, and distinctive characteristics. Be specific about colors, proportions, and unique features."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      return response.choices[0]?.message?.content || "Unable to analyze character image";
    } catch (error) {
      console.error('Error analyzing character image:', error);
      return "Character analysis unavailable";
    }
  }

  /**
   * Generate character-consistent illustration using GPT-image-1 with actual image reference
   * Uses the Image Edit API with multipart form data (official Microsoft approach)
   */
  async generateWithImageReference(
    character: Character,
    sceneDescription: string,
    imagePath: string,
    storyTitle?: string,
    pageNumber?: number
  ) {
    try {
      if (!this.azureOpenAI) {
        throw new Error('Azure OpenAI not configured for GPT-image-1');
      }

      const prompt = `Transform this character image into a new scene: ${sceneDescription}. 
Maintain the exact same character appearance, facial features, and style. 
Character: ${character.name}, age ${character.age}, personality: ${character.personality.join(', ')}. 
Style: High-quality children's book illustration, vibrant colors, magical atmosphere.
${storyTitle ? `Story: ${storyTitle}` : ''}
${pageNumber ? `Page: ${pageNumber}` : ''}`;

      // Use the image edit API with multipart form data
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Create a FormData-like object for the request
      const response = await this.makeImageEditRequest(
        imageBuffer,
        prompt,
        character.name
      );

      let localUrl: string | undefined;
      if (this.shouldSave() && response.b64_json) {
        const buffer = Buffer.from(response.b64_json, 'base64');
        const saved = await this.saveBufferToFile(buffer, `gptimg-${Date.now()}-p${pageNumber || 1}`, 'png');
        localUrl = saved.publicUrl;
      }
      return {
        success: true,
        data: {
          b64_json: response.b64_json,
          description: sceneDescription,
          pageNumber: pageNumber || 1,
          model: 'gpt-image-1',
          characterReferenced: true,
          ...(localUrl ? { localUrl } : {})
        }
      };
    } catch (error: any) {
      console.error('GPT-image-1 generation failed:', error);
      
      // Fallback to DALL-E 3 with enhanced text description
      console.log('Falling back to DALL-E 3 with enhanced description...');
      const fallbackResult = await this.generateCharacterConsistentIllustration(
        {
          character,
          sceneDescription,
          pageNumber: pageNumber || 1,
          storyTitle: storyTitle || 'Story'
        },
        character.imageUrl || ''
      );
      
      // Convert to expected format
      return {
        success: true,
        data: {
          url: fallbackResult.url,
          description: fallbackResult.description,
          pageNumber: fallbackResult.pageNumber,
          model: 'dall-e-3',
          characterReferenced: false,
          ...(fallbackResult as any).localUrl ? { localUrl: (fallbackResult as any).localUrl } : {}
        }
      };
    }
  }

  /**
   * Make raw HTTP request to GPT-image-1 image edit API using multipart form data
   * Based on official Microsoft documentation
   */
  private async makeImageEditRequest(imageBuffer: Buffer, prompt: string, filename: string) {
    const FormData = require('form-data');
    const axios = require('axios');
    
    const form = new FormData();
    form.append('image', imageBuffer, {
      filename: `${filename}.jpg`,
      contentType: 'image/jpeg'
    });
    form.append('prompt', prompt);
    form.append('model', 'gpt-image-1');
    form.append('size', '1024x1024');
    form.append('quality', 'high');
    form.append('n', '1');
    form.append('input_fidelity', 'high');

    const url = `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}/images/edits?api-version=${process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview'}`;
    
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        'api-key': process.env.AZURE_OPENAI_API_KEY,
      },
    });

    return response.data.data[0];
  }

  private buildImagePrompt(character: Character, sceneDescription: string, storyTitle: string): string {
    const characterDescription = this.buildCharacterDescription(character);
    
    return `Create a beautiful, vibrant children's book illustration in a magical storybook art style:

CHARACTER TO FEATURE:
${characterDescription}

SCENE DESCRIPTION:
${sceneDescription}

STORY CONTEXT: "${storyTitle}"

ART STYLE REQUIREMENTS:
- Whimsical children's book illustration style
- Bright, cheerful colors that appeal to children
- Soft, friendly art style (similar to modern picture books)
- Magic and wonder should be visible in the scene
- Safe, positive imagery appropriate for age ${character.age}
- High quality, detailed artwork suitable for printing
- Expressive characters that children can relate to

TECHNICAL SPECS:
- Square format suitable for storybook pages
- Clear, uncluttered composition
- Warm, inviting lighting
- Professional children's book illustration quality`;
  }

  private buildImagePromptWithCharacterReference(character: Character, sceneDescription: string, storyTitle: string): string {
    const baseDescription = this.buildCharacterDescription(character);
    
    // Enhanced prompt that references the uploaded character image
    return `Create a beautiful, vibrant children's book illustration in a magical storybook art style:

MAIN CHARACTER:
- Use the appearance and features from the reference character image
- Name: ${character.name}, age ${character.age}
- Personality traits: ${character.personality?.join(', ') || 'brave and kind'}
- Keep the character's unique features, hair, clothing style, and overall appearance consistent with the reference image
- Maintain the same facial features, skin tone, and distinctive characteristics

SCENE DESCRIPTION:
${sceneDescription}

STORY CONTEXT: "${storyTitle}"

CHARACTER CONSISTENCY REQUIREMENTS:
- The character must look like the same person throughout all illustrations
- Maintain consistent facial features, hair style, clothing preferences
- Keep the character's age-appropriate appearance (age ${character.age})
- Show the character's personality through body language and expression
- If the character has distinctive features in the reference image, keep them

ART STYLE REQUIREMENTS:
- Whimsical children's book illustration style
- Bright, cheerful colors that appeal to children
- Soft, friendly art style (similar to modern picture books)
- Magic and wonder should be visible in the scene
- Safe, positive imagery appropriate for age ${character.age}
- High quality, detailed artwork suitable for printing
- Professional children's book illustration quality

TECHNICAL SPECS:
- Square format suitable for storybook pages
- Clear, uncluttered composition
- Warm, inviting lighting
- Focus on the character as the hero of the scene`;
  }

  private buildCharacterPortraitPrompt(character: Character): string {
    const characterDescription = this.buildCharacterDescription(character);
    
    return `Create a beautiful character portrait for a children's storybook:

${characterDescription}

ART REQUIREMENTS:
- Friendly, approachable portrait style
- Bright, warm colors
- Professional children's book illustration quality
- Age ${character.age} child should look heroic and confident
- Magical, inspiring background elements
- High-quality detailed artwork
- Safe, positive imagery appropriate for children`;
  }

  private buildCharacterDescription(character: Character): string {
    let description = `- Main character: ${character.name}, a ${character.age}-year-old with ${character.personality?.join(', ') || 'a brave and kind'} personality`;
    
    if (character.interests?.length) {
      description += `\n- Interests: ${character.interests.join(', ')}`;
    }

    if (character.sisters?.length) {
      description += `\n- Family: Has loving sisters named ${character.sisters.map(s => s.name).join(' and ')}`;
    }

    return description;
  }

  private handleImageGenerationError(error: any): Error {
    console.error('OpenAI Image Generation Error:', error);
    
    if (error.code === 'insufficient_quota') {
      return new Error('OpenAI API quota exceeded for image generation.');
    }
    
    if (error.code === 'content_policy_violation') {
      return new Error('Image request violates OpenAI content policy.');
    }

    if (error.code === 'rate_limit_exceeded') {
      return new Error('Rate limit exceeded. Please try again later.');
    }

    return new Error(`Image generation failed: ${error.message || 'Unknown error'}`);
  }

  /**
   * Convert uploaded image file to base64 for GPT-image-1
   */
  async convertImageToBase64(imagePath: string): Promise<string> {
    try {
      const fs = require('fs').promises;
      const imageBuffer = await fs.readFile(imagePath);
      const base64String = imageBuffer.toString('base64');
      
      // Determine MIME type based on file extension
      const extension = imagePath.toLowerCase().split('.').pop();
      const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
      
      return `data:${mimeType};base64,${base64String}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to convert image to base64');
    }
  }

  /**
   * Check if GPT-image-1 is available
   */
  isGPTImage1Available(): boolean {
    return this.azureOpenAI !== null && 
           process.env.AZURE_OPENAI_DEPLOYMENT_NAME !== undefined;
  }

  /**
   * Hybrid generation method - tries GPT-image-1 first, falls back to DALL-E 3
   */
  async generateCharacterIllustrationHybrid(
    character: Character,
    sceneDescription: string,
    storyTitle: string,
    pageNumber?: number
  ) {
    try {
      const fs = require('fs');
      const path = require('path');
      const resolveRefImagePath = (raw?: string): string | undefined => {
        if (!raw) return undefined;
        try {
          const uploadsDir = path.join(process.cwd(), 'uploads');
          // 1. If it's an absolute filesystem path and exists
          if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;
          // 2. If it's a full URL, take the basename
          if (/^https?:\/\//i.test(raw)) {
            const base = path.basename(new URL(raw).pathname);
            const candidate = path.join(uploadsDir, base);
            if (fs.existsSync(candidate)) return candidate;
          }
          // 3. If it starts with /uploads or uploads
            const baseName = path.basename(raw);
            const candidate = path.join(uploadsDir, baseName);
            if (fs.existsSync(candidate)) return candidate;
          // 4. Last attempt: raw relative to CWD
          const rel = path.join(process.cwd(), raw.replace(/^\/+/, ''));
          if (fs.existsSync(rel)) return rel;
        } catch (e) {
          console.warn('Reference image resolution error:', (e as Error).message);
        }
        return undefined;
      };

      const refImagePath = resolveRefImagePath(character.imageUrl);

      // 1. Native GPT-image-1 (if enabled)
  if (refImagePath && this.isNativeGPTImage1Enabled() && fs.existsSync(refImagePath)) {
        try {
          console.log('🚀 Attempting NATIVE GPT-image-1 generation with character reference...');
          return await this.generateWithImageReferenceNative(
            character,
            sceneDescription,
            refImagePath,
            storyTitle,
            pageNumber
          );
        } catch (e) {
          console.warn('Native GPT-image-1 failed, will try Azure if available:', (e as Error).message);
        }
      }

      // 2. Azure GPT-image-1 (if available)
  if (refImagePath && this.isGPTImage1Available() && fs.existsSync(refImagePath)) {
        try {
          console.log('☁️ Attempting AZURE GPT-image-1 generation with character reference...');
          return await this.generateWithImageReference(
            character,
            sceneDescription,
            refImagePath,
            storyTitle,
            pageNumber
          );
        } catch (e) {
          console.warn('Azure GPT-image-1 failed, falling back to DALL-E:', (e as Error).message);
        }
      }

      // 3. Fallback to enhanced DALL-E 3 generation
      console.log('🎨 Using DALL-E 3 fallback generation...');
      return await this.generateCharacterConsistentIllustration({
        character,
        sceneDescription,
        pageNumber: pageNumber || 1,
        storyTitle
      }, character.imageUrl || '');
    } catch (error) {
      console.error('Hybrid generation failed:', error);
      throw error;
    }
  }

  /**
   * Analyze a local uploaded character image (base64 inline) to derive a stable textual descriptor.
   * This does NOT influence DALL-E directly but is reused to prompt for consistency.
   */
  async analyzeCharacterImageBase64(localImageUrl: string, personalityTraits: string[] = []) {
    if (process.env.ENABLE_IMAGE_ANALYSIS !== 'true') {
      throw new Error('Image analysis disabled');
    }
    const fs = await import('fs');
    const path = await import('path');
    const crypto = await import('crypto');

    const abs = path.isAbsolute(localImageUrl)
      ? localImageUrl
      : path.join(process.cwd(), localImageUrl.replace(/^\/+/, ''));

    const fileBuf = await fs.promises.readFile(abs);
    const max = Number(process.env.IMAGE_ANALYSIS_MAX_BYTES || 5_000_000);
    if (fileBuf.length > max) throw new Error(`Image too large (${fileBuf.length} > ${max})`);

    const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
    if (this.descriptorCache.has(hash)) {
      return { ...this.descriptorCache.get(hash)!, cached: true };
    }

    const ext = path.extname(abs).toLowerCase().replace('.', '');
    const mime = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
    const base64 = fileBuf.toString('base64');
    const traitsLine = personalityTraits.length ? `Known personality traits: ${personalityTraits.join(', ')}.` : '';
    const model = process.env.IMAGE_ANALYSIS_MODEL || 'gpt-4o';

    const prompt = `You assist in building consistent children's book character illustrations.\n` +
      `Return ONE compact paragraph describing ONLY visible physical attributes & style: hair (style/color), ` +
      `eyes (if clearly visible), approximate age impression, notable accessories, expression/mood vibe, broad skin ` +
      `tone wording, clothing style hints, palette hint. Do NOT guess unseen details. Avoid sensitive or private attributes.\n${traitsLine}`;

  const client = this.ensureOpenAI();
  const response = await client.chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
          ]
        }
      ],
      max_tokens: 250
    });

    const descriptor = response.choices?.[0]?.message?.content?.trim() || 'Friendly child with neutral appearance.';
    const result = { hash, descriptor, model, confidence: 0.9, cached: false };
    this.descriptorCache.set(hash, result);
    return result;
  }

  getDescriptorCacheSize() { return this.descriptorCache.size; }
}