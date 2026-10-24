import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { GeminiService } from './services/geminiService.js';
import { GnaniService } from './services/gnaniService.js';
import { createChatController } from './controllers/chatController.js';
import { createTTSController } from './controllers/ttsController.js';
import { ConversationController } from './controllers/conversationController.js';
import { setupSTTWebSocket } from './websockets/sttHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Validate environment variables
const PORT = process.env.PORT || 3000;
const GNANI_API_KEY = process.env.GNANI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GNANI_API_KEY) {
  console.warn('⚠️ Warning: GNANI_API_KEY is not defined in .env');
}
if (!GEMINI_API_KEY) {
  console.warn('⚠️ Warning: GEMINI_API_KEY is not defined in .env');
}

// Initialize services
const geminiService = new GeminiService(GEMINI_API_KEY);
const gnaniService = new GnaniService(GNANI_API_KEY);

// Setup Express application
const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend statically (check dist first for production build)
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
const frontendPath = fs.existsSync(distPath) ? distPath : path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// REST Endpoints
app.post('/api/chat', createChatController(geminiService));
app.post('/api/tts', createTTSController(gnaniService));
app.get('/api/conversations', ConversationController.getAll);
app.get('/api/conversations/:id', ConversationController.getById);
app.delete('/api/conversations/:id', ConversationController.deleteById);
app.delete('/api/conversations', ConversationController.deleteAll);

// Fallback to frontend index.html for SPA routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next();
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Setup HTTP & WebSocket server
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/stt' });

setupSTTWebSocket(wss, GNANI_API_KEY);

server.listen(PORT, () => {
  console.log(`\n🎙️ Voice Agent Server running at http://localhost:${PORT}`);
  console.log(`📁 Frontend served from: ${frontendPath}`);
  console.log(`🔑 Environment loaded from .env\n`);
});
