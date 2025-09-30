import { Character } from '../types/index.js';
import { ImageGenerationService } from './ImageGenerationService.js';
import { randomUUID } from 'crypto';

export interface IllustrationJobRequest {
  storyId: string;
  character: Character;
  storyTitle: string;
  scenes: { description: string; pageNumber: number }[];
}

export type IllustrationJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface IllustrationJobResultItem {
  pageNumber: number;
  description: string;
  model: string;
  characterReferenced?: boolean;
  url?: string;
  b64_json?: string;
  localUrl?: string;
}

export interface IllustrationJobRecord {
  id: string;
  request: IllustrationJobRequest;
  status: IllustrationJobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
  results: IllustrationJobResultItem[];
}

/**
 * In-memory async job manager for illustration generation.
 * NOTE: Non-persistent. Suitable for development/demo.
 */
export class IllustrationJobManager {
  private jobs: Map<string, IllustrationJobRecord> = new Map();
  private processing = false;
  private imageService = new ImageGenerationService();

  enqueue(request: IllustrationJobRequest): IllustrationJobRecord {
    const id = randomUUID();
    const record: IllustrationJobRecord = {
      id,
      request,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      results: []
    };
    this.jobs.set(id, record);
    this.kick();
    return record;
  }

  get(id: string) { return this.jobs.get(id); }

  list(limit = 50): IllustrationJobRecord[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }

  private async kick() {
    if (this.processing) return;
    this.processing = true;
    try {
      while (true) {
        const next = Array.from(this.jobs.values()).find(j => j.status === 'queued');
        if (!next) break;
        await this.process(next);
      }
    } finally {
      this.processing = false;
    }
  }

  private async process(job: IllustrationJobRecord) {
    job.status = 'processing';
    job.updatedAt = new Date().toISOString();
    const { character, scenes, storyTitle } = job.request;

    for (const scene of scenes) {
      try {
        let result: any;
        // Use hybrid method for best quality & reference support
        result = await this.imageService.generateCharacterIllustrationHybrid(
          character,
          scene.description,
          storyTitle,
          scene.pageNumber
        );

        if (result?.success && result.data) {
          job.results.push({
            pageNumber: scene.pageNumber,
            description: scene.description,
            model: result.data.model || 'unknown',
            characterReferenced: result.data.characterReferenced,
            url: result.data.url,
            b64_json: result.data.b64_json,
            localUrl: result.data.localUrl
          });
        } else if (result?.url) { // DALL-E fallback shape
          job.results.push({
            pageNumber: scene.pageNumber,
            description: scene.description,
            model: 'dall-e-3',
            url: result.url,
            localUrl: (result as any).localUrl
          });
        }
      } catch (e: any) {
        job.error = `Failed scene p${scene.pageNumber}: ${e?.message}`;
      }
    }

    job.status = 'completed';
    job.updatedAt = new Date().toISOString();
  }
}

export const illustrationJobManager = new IllustrationJobManager();
