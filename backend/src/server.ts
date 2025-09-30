import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import storyRoutes from './routes/stories.js';
import imageRoutes from './routes/images.js';
import characterImageRoutes from './routes/characterImage.js';
import { FileUploadService } from './services/FileUploadService.js';

// Load environment variables
dotenv.config();

// Debug: Check if API key is loaded
console.log('🔑 OpenAI API Key loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
console.log('🔑 API Key length:', process.env.OPENAI_API_KEY?.length || 0);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize services (Dependency Injection)
const fileUploadService = new FileUploadService();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Serve generated images if directory exists
import fs from 'fs';
const generatedDir = path.join(process.cwd(), process.env.GENERATED_IMAGE_DIR || 'generated');
if (fs.existsSync(generatedDir)) {
  app.use('/generated', express.static(generatedDir));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Routes
app.use('/api/stories', storyRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/character', characterImageRoutes);

// List generated images (simple listing)
app.get('/api/images/generated', (req, res) => {
  try {
    if (!fs.existsSync(generatedDir)) {
      return res.json({ success: true, data: [] });
    }
    const files = fs.readdirSync(generatedDir)
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(generatedDir, f));
        return {
          filename: f,
          url: `/generated/${f}`,
          size: stat.size,
          createdAt: stat.birthtime
        };
      })
      .sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json({ success: true, data: files });
  } catch (e:any) {
    res.status(500).json({ success: false, error: 'Failed to list generated images', details: e.message });
  }
});

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'OK', 
    message: 'Storybook API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// File upload endpoint
app.post('/api/upload', upload.single('character-image'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }
    
    const filePath = await fileUploadService.uploadFile(req.file);
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        filename: req.file.filename,
        path: filePath
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    res.status(500).json({ 
      success: false,
      error: errorMessage 
    });
  }
});

// Global error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false, 
        error: 'File too large' 
      });
    }
  }
  
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    details: error.message
  });
});

// 404 handler
app.use('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📖 Storybook API ready at http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});