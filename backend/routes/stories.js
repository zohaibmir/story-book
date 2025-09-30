import express from 'express';
import OpenAI from 'openai';

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate story endpoint
router.post('/generate', async (req, res) => {
  try {
    const { character, prompt, themes, setting } = req.body;

    if (!character || !prompt) {
      return res.status(400).json({ error: 'Character and prompt are required' });
    }

    // Construct the story prompt for OpenAI
    const storyPrompt = `Create a personalized children's storybook story with the following details:

Character Information:
- Name: ${character.name}
- Age: ${character.age}
- Personality Traits: ${character.personality?.join(', ') || 'Not specified'}
- Interests: ${character.interests?.join(', ') || 'Not specified'}
${character.sisters ? `- Sisters: ${character.sisters.map(s => `${s.name} (${s.traits})`).join(', ')}` : ''}

Story Requirements:
- Theme: ${themes || 'Adventure and friendship'}
- Setting: ${setting || 'Magical world'}
- User Prompt: ${prompt}

${character.personalMessage ? `Personal Message to include: ${character.personalMessage}` : ''}

Please create a complete storybook with:
1. A compelling title
2. 6-8 story spreads (pages)
3. Vivid descriptions suitable for illustration
4. Age-appropriate language for ${character.age} years old
5. Incorporate the character's personality traits naturally
6. Include the themes of friendship, family bonds, and adventure
7. Make it magical and inspiring

Format the response as a structured story with clear page breaks and descriptions for illustrations.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a creative children's book author who specializes in personalized, magical stories that inspire young readers. Create engaging, age-appropriate stories with vivid imagery perfect for illustration."
        },
        {
          role: "user",
          content: storyPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.8,
    });

    const story = completion.choices[0].message.content;

    res.json({
      success: true,
      story: story,
      character: character,
      metadata: {
        generatedAt: new Date().toISOString(),
        model: "gpt-4",
        wordCount: story.split(' ').length
      }
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    if (error.code === 'insufficient_quota') {
      return res.status(402).json({ error: 'OpenAI API quota exceeded. Please check your billing.' });
    }
    
    if (error.code === 'invalid_api_key') {
      return res.status(401).json({ error: 'Invalid OpenAI API key. Please check your configuration.' });
    }

    res.status(500).json({ 
      error: 'Failed to generate story',
      details: error.message 
    });
  }
});

// Get story suggestions endpoint
router.post('/suggestions', async (req, res) => {
  try {
    const { character } = req.body;

    if (!character) {
      return res.status(400).json({ error: 'Character information is required' });
    }

    const suggestionPrompt = `Based on this character profile, suggest 5 creative story prompts:

Character: ${character.name}, age ${character.age}
Personality: ${character.personality?.join(', ') || 'Not specified'}
Interests: ${character.interests?.join(', ') || 'Not specified'}

Generate 5 age-appropriate, engaging story prompts that would appeal to this character. Make them magical, adventurous, and inspiring. Each prompt should be 1-2 sentences.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a creative writing assistant specializing in children's story ideas. Generate engaging, age-appropriate prompts."
        },
        {
          role: "user",
          content: suggestionPrompt
        }
      ],
      max_tokens: 500,
      temperature: 0.9,
    });

    const suggestions = completion.choices[0].message.content
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0);

    res.json({
      success: true,
      suggestions: suggestions
    });

  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate suggestions',
      details: error.message 
    });
  }
});

export default router;