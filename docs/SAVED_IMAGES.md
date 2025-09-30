## Generated Image Persistence

When `SAVE_GENERATED_IMAGES=true` the backend will persist each generated illustration (DALL-E 3 or GPT-image-1) to disk.

### Directory Layout
Configured via `GENERATED_IMAGE_DIR` (default `generated`) at project root (same level as `backend/`). Files are served read‑only at:
```
/generated/<filename>
```

### Filename Pattern
```
story-<epoch>-p<page>.png          # Generic story illustration
consistent-<epoch>-p<page>.png     # Character-consistent attempt with DALL-E prompt
gptimg-<epoch>-p<page>.png         # GPT-image-1 reference/edit result
```

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/images/generated` | GET | List saved images (filename, url, size, createdAt) |
| `/generated/<file>` | GET (static) | Serve the binary image |

### Illustration Object (Response Snippet)
Each illustration returned in `/api/stories/generate` includes:
```jsonc
{
  "url": "https://... (remote model URL)",
  "localUrl": "/generated/story-1738355170000-p1.png", // present if saving enabled
  "description": "Scene description...",
  "pageNumber": 1,
  "model": "dall-e-3",
  "characterReferenced": true | false
}
```

### Enabling / Disabling
Set in `.env` / `.env.template`:
```
SAVE_GENERATED_IMAGES=true
GENERATED_IMAGE_DIR=generated
GENERATED_IMAGE_FORMAT=png
```
Toggle off by setting `SAVE_GENERATED_IMAGES=false` (images will NOT be saved or exposed locally).

### Cleanup Strategy
Currently no automatic pruning. Recommended options:
1. Manual periodic deletion: `find generated -type f -mtime +14 -delete`
2. Add a small maintenance script / cron.
3. Migrate to object storage (S3 / Azure Blob) for scale.

### Security Considerations
* Images are publicly accessible while the dev server runs. For production you should:
  - Add auth / signed URLs OR
  - Move images behind CDN with proper access rules.
* Filenames are sanitized (non-alphanumeric replaced with `_`).

### Future Enhancements (Not Implemented Yet)
* Retention policy (max file age or total disk quota)
* Hash-based duplicate detection
* Metadata index (DB or JSON) for faster queries
* Async background generation after story text returns

### Troubleshooting
| Symptom | Cause | Resolution |
|---------|-------|------------|
| `localUrl` missing | `SAVE_GENERATED_IMAGES` not `true` | Enable flag & restart server |
| 404 on `/generated/...` | Directory not created yet | Generate at least one image (folder auto-creates) |
| Empty `/api/images/generated` | No images generated or all failed | Check server logs for image generation errors |
| Very large disk usage | Many images accumulated | Implement cleanup strategy |

---
This file documents internal dev behavior; adapt before production deployment.
