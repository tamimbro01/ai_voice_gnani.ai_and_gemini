# AI Voice Agent — Powered by Gemini AI & Gnani.ai 🎙️⚡

A real-time, low-latency Conversational Voice Agent built with a modular component-based frontend and an Express + WebSocket backend.

## 🚀 Features

- **Real-time Voice Calling**: Speak naturally through your microphone; no typing or text chat required.
- **Gnani.ai Speech-to-Text (STT)**: 16kHz linear PCM audio streamed in real-time via WebSockets to Gnani's Vachana Speech APIs.
- **Google Gemini AI**: Ultra-fast conversational intelligence tuned for voice dialogue with automatic model fallbacks (`gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-3.8-flash`).
- **Gnani.ai Text-to-Speech (TTS)**: Natural, human-like voice synthesis (`timbre-v2.5` model) streamed directly as WAV audio.
- **Zero Authentication Required**: No login or sign-up needed.
- **Local Persistence**: All conversations are stored locally in `backend/data/conversations.json`.
- **Component-Based Frontend**: Vanilla ES modules with reactive state management (Sidebar, Topbar, ChatArea, VoiceControls, Toast).
- **Multi-Language Support**: English (`en-IN`), Bengali (`bn-IN`), Hindi (`hi-IN`), Telugu (`te-IN`), Tamil (`ta-IN`).

---

## 📁 Project Architecture

```text
├── backend/
│   ├── .env                    # Secret API keys (ignored by git)
│   ├── .env.example            # Environment template
│   ├── package.json
│   ├── server.js               # Express + WebSocket server
│   ├── data/
│   │   └── conversations.json  # Local conversation storage
│   ├── controllers/            # API endpoints (chat, tts, conversations)
│   ├── services/               # Gemini AI, Gnani.ai TTS, Storage
│   └── websockets/             # Real-time STT WebSocket proxy
│
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── src/
│       ├── main.js             # Application orchestrator
│       ├── state.js            # Reactive store & event bus
│       ├── services/           # API client, audio recorder & player
│       └── components/         # Modular UI components
│
└── package.json                # Root startup scripts
```

---

## 🛠️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/tamimbro01/ai_voice_gnani.ai_and_gemini.git
cd ai_voice_gnani.ai_and_gemini
```

### 2. Configure Environment Variables
Inside `backend/`, copy `.env.example` to `.env`:
```bash
cp backend/.env.example backend/.env
```
Fill in your API keys in `backend/.env`:
```ini
PORT=3000
GNANI_API_KEY=your_gnani_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Install Dependencies
```bash
cd backend
npm install
```

### 4. Run the Application
From root:
```bash
npm start
```
Or from `backend/`:
```bash
node server.js
```
Open **http://localhost:3000** in your browser and start speaking!

### Voice conversation

Click the microphone once and allow microphone access. The app streams microphone PCM through the backend to Gnani Vachana STT; after a short pause it sends the recognized turn to Gemini, plays Gnani Timbre TTS, and resumes listening. Click the microphone again to end voice mode. Use the stop button beside the microphone to interrupt the current spoken reply.

Microphone access requires `localhost` or HTTPS. If no transcript appears, check that `GNANI_API_KEY` is valid and that the browser has microphone permission. If Gemini reports a quota error, wait for the project's quota reset or update its Google AI billing/limits. Keep both API keys in `backend/.env`; never set them as `VITE_` variables.
