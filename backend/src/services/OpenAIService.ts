import OpenAI from 'openai';
import { Character, IStoryGenerator, ISuggestionGenerator } from '../types/index.js';

export class OpenAIService implements IStoryGenerator, ISuggestionGenerator {
  private openai: OpenAI;
  private readonly model: string = 'gpt-4o'; // Latest GPT-4 model with enhanced capabilities
  private readonly maxTokens: number = 2000;
  private readonly temperature: number = 0.8;

  constructor(apiKey: string) {
    console.log('🤖 OpenAI Service initialized with key length:', apiKey.length);
    this.openai = new OpenAI({ apiKey });
  }

  async generateStory(
    character: Character, 
    prompt: string, 
    themes?: string, 
    setting?: string,
    characterDescriptor?: string
  ): Promise<string> {
    const storyPrompt = this.buildStoryPrompt(character, prompt, themes, setting, characterDescriptor);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a wise storyteller who helps children see themselves as heroes. Create empowering, magical stories where the child character discovers their inner strength, grows through challenges, and learns they are capable, brave, and special. Every story should celebrate family bonds, show character growth, and end with the child feeling more confident about themselves. Use vivid, illustration-friendly descriptions while maintaining age-appropriate content that builds self-esteem."
          },
          {
            role: "user",
            content: storyPrompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  async generateSuggestions(character: Character): Promise<string[]> {
    const suggestionPrompt = this.buildSuggestionPrompt(character);

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini', // Faster model for suggestions
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

      const content = completion.choices[0].message.content || '';
      return this.parseSuggestions(content);
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  private buildStoryPrompt(
    character: Character, 
    prompt: string, 
    themes?: string, 
    setting?: string,
    characterDescriptor?: string
  ): string {
    return `Create an empowering, personalized children's storybook where the child is the hero of their own adventure:

HERO CHARACTER:
- Name: ${character.name}
- Age: ${character.age}  
- Heroic Qualities: ${character.personality?.join(', ') || 'Brave and kind'}
- Special Interests: ${character.interests?.join(', ') || 'Learning and exploring'}
${character.sisters ? `- Family Support Team: ${character.sisters.map(s => `${s.name} (${s.traits})`).join(', ')}` : ''}

HEROIC JOURNEY:
- Growth Theme: ${themes || 'Discovering inner courage and strength'}
- Magical Setting: ${setting || 'A world of wonder and possibility'}
- Adventure Challenge: ${prompt}

${character.personalMessage ? `SPECIAL WISDOM TO WEAVE IN: ${character.personalMessage}` : ''}

Create a complete heroic journey storybook with:

EMPOWERMENT REQUIREMENTS:
✨ ${character.name} must be the active hero who solves problems
✨ Show ${character.name} discovering their own inner strength  
✨ Celebrate what makes ${character.name} unique and special
✨ Include moments where family bonds provide support
✨ End with ${character.name} feeling more confident and capable

STORY STRUCTURE:
1. Compelling title that celebrates ${character.name}
2. 6-8 illustrated story spreads
3. Clear heroic journey: Challenge → Growth → Triumph
4. Age-appropriate language for ${character.age} years old
5. Vivid, magical descriptions perfect for illustration
6. ${character.name}'s personality traits become their superpowers
7. Family love and support strengthen ${character.name}
8. Inspiring ending where ${character.name} learns they can overcome anything

EMOTIONAL GOALS:
- ${character.name} should feel brave, capable, and loved
- Readers should see themselves as heroes of their own stories
- Family bonds should feel warm and supportive
- Challenges should feel conquerable with inner strength

${characterDescriptor ? `\nIMAGE-DERIVED CHARACTER APPEARANCE DETAILS (use consistently for visual descriptions, do NOT restate verbatim every page):\n${characterDescriptor}\n` : ''}

Format as structured pages with illustration descriptions.`;
  }

  private buildSuggestionPrompt(character: Character): string {
    return `Based on this character profile, suggest 5 creative story prompts:

Character: ${character.name}, age ${character.age}
Personality: ${character.personality?.join(', ') || 'Not specified'}
Interests: ${character.interests?.join(', ') || 'Not specified'}

Generate 5 age-appropriate, engaging story prompts that would appeal to this character. Make them magical, adventurous, and inspiring. Each prompt should be 1-2 sentences.`;
  }

  private parseSuggestions(content: string): string[] {
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0);
  }

  private handleOpenAIError(error: any): Error {
    console.error('OpenAI API Error:', error);
    
    if (error.code === 'insufficient_quota') {
      return new Error('OpenAI API quota exceeded. Please check your billing.');
    }
    
    if (error.code === 'invalid_api_key') {
      return new Error('Invalid OpenAI API key. Please check your configuration.');
    }

    return new Error(`OpenAI API Error: ${error.message || 'Unknown error'}`);
  }
}