## Image Analysis & Story Generation CURL Examples

These commands assume the backend server is running locally on port 5000.

Preconditions:
1. Ensure `.env` has `ENABLE_IMAGE_ANALYSIS=true` and a valid `OPENAI_API_KEY`.
2. You have already uploaded a character image via the UI (path like `/uploads/character-image-12345.jpg`).

### 1. Analyze a Character Image

Replace the image URL with an existing uploaded image path.

```bash
curl -X POST http://localhost:5000/api/character/analyze-image \
  -H 'Content-Type: application/json' \
  -d '{
    "imageUrl": "/uploads/character-image-1759187119216-393742749.png",
    "traits": ["brave","curious","kind"]
  }'
``

Response shape:
```json
{
  "success": true,
  "data": {
    "hash": "<sha256>",
    "descriptor": "Concise physical description...",
    "model": "gpt-4o",
    "confidence": 0.9,
    "cached": false
  }
}
```

### 2. Generate Story WITH Character Descriptor

First, store the descriptor from step 1 in a shell variable (macOS zsh quoting example):

```bash
DESC="A concise appearance descriptor from analysis"
```

Then call the story generation endpoint:

```bash
curl -X POST http://localhost:5000/api/stories/generate \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg desc "$DESC" '{
    character: {
      name: "Ava",
      age: 7,
      personality: ["curious", "kind"],
      interests: ["puzzles", "exploring"],
      imageUrl: "/uploads/character-image-1759187119216-393742749.png"
    },
    prompt: "A mysterious glowing map appears in the attic leading to a puzzle forest",
    themes: "Courage and problem solving",
    setting: "Enchanted puzzle forest",
    characterDescriptor: $desc,
    generateIllustrations: true
  }')"
```

If you do not have `jq`, you can craft JSON manually (ensure proper escaping if descriptor has quotes):

```bash
curl -X POST http://localhost:5000/api/stories/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "character": {
      "name": "Ava",
      "age": 7,
      "personality": ["curious", "kind"],
      "interests": ["puzzles", "exploring"],
      "imageUrl": "/uploads/character-image-1759187119216-393742749.png"
    },
    "prompt": "A mysterious glowing map appears in the attic leading to a puzzle forest",
    "themes": "Courage and problem solving",
    "setting": "Enchanted puzzle forest",
    "characterDescriptor": "PASTE_DESCRIPTOR_HERE",
    "generateIllustrations": true
  }'
```

### 3. Regenerating With Cached Descriptor

Repeat the analysis call; `cached": true` indicates the descriptor came from cache.

### 4. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| 400 Image analysis disabled | ENABLE_IMAGE_ANALYSIS not true | Set `ENABLE_IMAGE_ANALYSIS=true` and restart server |
| 401/402 errors | OpenAI auth/quota issues | Verify key & billing |
| Descriptor empty | Model returned blank | Retry; ensure image is clear |
| Slow response (>25s) | Network or model latency | Reduce image size or retry |

### 5. Environment Flags Recap

```
ENABLE_IMAGE_ANALYSIS=true
IMAGE_ANALYSIS_MAX_BYTES=5000000
IMAGE_ANALYSIS_MODEL=gpt-4o
IMAGE_ANALYSIS_TIMEOUT_MS=30000
```

### 6. Notes
* Descriptor is injected into the system prompt to encourage consistent visual references.
* We intentionally keep descriptor compact to avoid prompt bloat.
* Illustrations remain experimental; DALL-E 3 does not take direct image references yet—descriptor helps textual consistency.
