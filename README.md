# AI Storybook Creator

A full-stack TypeScript application that creates personalized, AI-generated storybooks for children using OpenAI's GPT-4o model. Built following SOLID principles for maintainable, scalable code.

## Features

- **Character Creation**: Users can create detailed character profiles with personality traits, interests, and family members
- **Image Upload**: Upload character images to personalize the story experience  
- **AI Story Generation**: Powered by OpenAI GPT-4o for high-quality, personalized storytelling
- **Story Suggestions**: AI-generated story prompts based on character profiles
- **Interactive Interface**: Modern, accessible React frontend with TypeScript
- **Story Management**: Download, print, and share generated stories
- **Type Safety**: Full TypeScript implementation for better development experience
- **SOLID Principles**: Clean architecture with dependency injection and interface segregation

## Project Structure

```
storybook/
├── frontend/           # React application (Vite)
│   ├── src/
│   │   ├── components/ # React components
│   │   └── App.jsx     # Main application
│   └── package.json
├── backend/            # Node.js Express server
│   ├── routes/         # API routes
│   ├── uploads/        # File upload directory
│   └── server.js       # Main server file
└── package.json        # Root package.json
```

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

## Setup Instructions

### 1. Install Dependencies

```bash
# Install all dependencies (root, frontend, and backend)
npm run install:all
```

### 2. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file and add your OpenAI API key:

```env
PORT=5000
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o
MAX_FILE_SIZE=5242880
UPLOAD_DIR=uploads
CORS_ORIGIN=http://localhost:3000
```

### 3. Run the Application

#### Development Mode (Both Frontend and Backend)
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000 (TypeScript with hot reload)
- Frontend development server on http://localhost:3000 (React with TypeScript)

#### Type Checking
```bash
# Check TypeScript types for frontend
cd frontend && npm run type-check

# Check TypeScript types for backend  
cd backend && npm run type-check
```

#### Production Mode
```bash
# Build backend TypeScript
cd backend && npm run build

# Build frontend
cd frontend && npm run build

# Start production server
cd backend && npm start
```

## API Endpoints

### Stories
- `POST /api/stories/generate` - Generate a personalized story
- `POST /api/stories/suggestions` - Get story prompt suggestions

### File Upload
- `POST /api/upload` - Upload character images

### Health Check
- `GET /api/health` - Server health status

## Usage

1. **Create Character**: Fill in character details including name, age, personality traits, and interests
2. **Upload Image** (Optional): Add a character image for personalization
3. **Generate Story**: Enter a story prompt or select from AI-generated suggestions
4. **Customize**: Add themes and settings for the story
5. **Read & Share**: View the generated story and download or share it

## Example Character Profile

Based on the example provided:

```json
{
  "name": "Loulia Nouelati (Lulu)",
  "age": 10,
  "personality": ["Brave", "Curious", "Loving older sister", "Bookworm"],
  "interests": ["Nintendo Switch", "Reading", "Adventure"],
  "sisters": [
    {
      "name": "Sara Nouelati (Sisi)",
      "traits": "Calm, wise, confident, loves dancing and fairytales"
    },
    {
      "name": "Aya Nouelati (Ayoushe)",
      "traits": "Fun, energetic, imaginative, problem-solving"
    }
  ],
  "personalMessage": "To the one who started it all, to the one who opened the door for emotions that has never existed before. The future will always hold what's best for you, believe, trust and leap! I love you, - Khalo Ali."
}
```

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite (build tool and dev server)
- Axios (HTTP client with type safety)
- Modern CSS with custom properties
- Type-safe component architecture

### Backend  
- Node.js with Express and TypeScript
- OpenAI GPT-4o API integration
- SOLID principles implementation
- Service-based architecture with dependency injection
- Interface segregation for maintainable code
- Multer (file upload handling)
- CORS enabled
- Environment variable configuration

## Architecture & SOLID Principles

This application follows SOLID principles for clean, maintainable code:

### Single Responsibility Principle (SRP)
- Each service class has a single, well-defined responsibility
- `OpenAIService`: Handles all AI interactions
- `FileUploadService`: Manages file upload operations
- Components focus on specific UI concerns

### Open/Closed Principle (OCP)
- Services are open for extension but closed for modification
- New story generation strategies can be added without changing existing code
- Component props are designed for extensibility

### Liskov Substitution Principle (LSP)
- Service interfaces can be substituted with different implementations
- `IStoryGenerator` and `ISuggestionGenerator` interfaces allow for different AI providers

### Interface Segregation Principle (ISP)
- Interfaces are focused and don't force clients to depend on unused methods
- Separate interfaces for story generation and suggestions
- Type-safe API contracts between frontend and backend

### Dependency Inversion Principle (DIP)
- High-level modules don't depend on low-level modules
- Dependencies are injected rather than created directly
- Services depend on abstractions (interfaces) not concrete implementations

## Development

### Adding New Features

1. Backend: Add routes in `backend/src/routes/`
2. Frontend: Create components in `frontend/src/components/`
3. Update type definitions in respective `types/` directories
4. Follow established patterns for service injection

### File Upload Configuration

The application supports image uploads with the following constraints:
- File types: JPEG, JPG, PNG, GIF
- Maximum file size: 5MB
- Files are stored in `backend/uploads/`

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**
   - Check your API key in the `.env` file
   - Verify your OpenAI account has sufficient credits
   - Ensure API key has the correct permissions

2. **File Upload Issues**
   - Check that the `uploads` directory exists
   - Verify file size limits
   - Ensure correct file types are being uploaded

3. **CORS Errors**
   - Backend CORS is configured to allow all origins in development
   - For production, update CORS configuration as needed

## License

This project is licensed under the ISC License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions, please create an issue in the repository or contact the development team.