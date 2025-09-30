# Async Illustrations & Native GPT-Image-1 Integration

This document describes the new capabilities added to the system for generating illustrations asynchronously and leveraging both native (OpenAI) and Azure deployments of `gpt-image-1` with graceful fallback to DALL-E 3.

## Overview

| Feature | Description |
|---------|-------------|
| Native GPT-Image-1 | Uses OpenAI's public `images/edits` endpoint with reference character image for consistent illustrations |
| Azure GPT-Image-1 | Uses Azure deployment (if configured) for enterprise / quota separation |
| Hybrid Order | Native → Azure → DALL-E 3 fallback |
| Async Jobs | Story generation returns immediately; illustrations generated in background |
| Retention Policy | Optional pruning of saved generated images by count and/or total size |

## Environment Flags

Add these to `.env` (already added to template):

```bash
ENABLE_NATIVE_GPT_IMAGE1=true           # Enable native OpenAI edits endpoint
ASYNC_ILLUSTRATIONS=true                # Enable async job queue for illustrations
GENERATED_IMAGE_MAX_FILES=300           # Keep only newest N images (0 = unlimited)
GENERATED_IMAGE_MAX_MB=500              # Keep directory under N megabytes (0 = unlimited)
IMAGE_EDIT_TIMEOUT_MS=120000            # Native edits request timeout
```

## Request Flow (Async Mode)
1. Client POST `/api/stories/generate` with `generateIllustrations: true`.
2. Backend returns JSON with `metadata.illustrationsPending = true` and `metadata.illustrationJobId`.
3. Client polls `/api/stories/illustrations/job/:id` until `status === 'completed'`.
4. Once complete, each result item may have:
   - `url` (DALL-E) OR `b64_json` (gpt-image-1) and possibly `localUrl` if persistence enabled.

## Polling Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stories/illustrations/job/:id` | GET | Fetch status + results of a specific job |
| `/api/stories/illustrations/jobs` | GET | List recent jobs (development/debug) |

## Job Status Object

```json
{
  "id": "uuid",
  "status": "queued|processing|completed|failed",
  "results": [
    {
      "pageNumber": 1,
      "description": "Scene description",
      "model": "gpt-image-1" | "dall-e-3",
      "characterReferenced": true,
      "url": "/openai/cdn/url.png",
      "b64_json": "...",
      "localUrl": "/generated/gptimg-native-...png"
    }
  ],
  "error": null
}
```

## Fallback Logic
1. Attempt native `gpt-image-1` edit (if `ENABLE_NATIVE_GPT_IMAGE1=true`).
2. If native fails or disabled, attempt Azure `gpt-image-1` (if configured).
3. Fallback to DALL-E 3 with detailed textual descriptor for consistency.

## Retention Policy
Executed after each saved image:
- Deletes oldest images exceeding `GENERATED_IMAGE_MAX_FILES`.
- Then ensures total size ≤ `GENERATED_IMAGE_MAX_MB` by removing oldest remaining.
- Logs: `🧹 Retention pruning removed X old generated image(s).`

## Migration Notes
- Existing synchronous flow still supported (set `ASYNC_ILLUSTRATIONS=false`).
- Frontend should detect `illustrationsPending` & poll when true.
- Response schema extended; older clients ignoring new metadata remain compatible.

## Example: Story Generation (Async Enabled)
```bash
curl -X POST http://localhost:5000/api/stories/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "character": {"name":"Lila","age":7,"personality":["brave","curious"],"interests":["space"],"imageUrl":"/uploads/character-image-123.jpg"},
    "prompt": "A cosmic garden adventure",
    "generateIllustrations": true
  }'
```
Response (truncated):
```json
{
  "success": true,
  "data": {
    "story": "...",
    "metadata": {
      "illustrationJobId": "1fa2...",
      "illustrationsPending": true
    }
  }
}
```

Poll job:
```bash
curl http://localhost:5000/api/stories/illustrations/job/1fa2...
```

## Handling Base64 Images
When `b64_json` is returned (gpt-image-1), clients may:
```js
const imgSrc = data.localUrl || (data.b64_json ? `data:image/png;base64,${data.b64_json}` : data.url);
```

## Future Enhancements (Suggested)
- Persistent job store (Redis / DB) for restart resilience.
- WebSocket push for real-time job completion.
- Rate limiting & concurrency controls.
- Automatic descriptor injection into prompt for further refinement.

---
Feel free to extend this doc if adding frontend polling logic or production hardening.
