# Vani AI — Speech & Communication Coaching Platform

**Vani AI** is an intelligent, full-stack, voice-first English speaking and communication coaching application. Built to help users build conversational fluency, pronunciation accuracy, grammatical precision, and general speech confidence through interactive real-time AI practice.

---

## Key Features

- ** Vani AI Voice Partner**: Interactive real-time voice agent with browser-native low-latency Speech-to-Text and natural Text-to-Speech synthesis.
- ** Turn-Based Progressive Difficulty**: Conversations automatically scale turn-by-turn (**Easy Warm-up** → **Medium Expressive** → **Hard Deep-Thought**).
- ** Daily Challenges (GD & Picture Description)**: Alternate-day timed prompts for Group Discussion (GD) and Picture Description with audio recording and instant AI Coach feedback.
- ** Mock Interviews**: Simulates professional job interviews with custom roles, questions, timed audio responses, and multi-criteria evaluations.
- ** Speech Analytics & CEFR Forecast**: Real-time confidence, fluency, pronunciation scoring via Wav2Vec2 CTC alignment, and CEFR progression projections (A1 to C2).
- ** Non-English & Hindi Immersion Alert**: Real-time warning alerts when non-English or Hindi transliterated words are spoken to enforce 100% English immersion.
- ** Instant Session Resets**: One-click resetting of partner sessions to restart fresh at the warm-up difficulty level.

---

## 🎨 Theme & Design System

Designed with a modern, high-contrast, executive color palette:
- **Primary Accents**: 🟢 `#7A9E87` (Sage Slate Green) & `#F7F5F0` (White Smoke)
- **Secondary Accents**: 🔵 `#2C3E50` (Midnight Blue) & `#C4714A` (Peru Copper)
- **Vfx & UI**: Ambient glassmorphism, animated **Vani Voice Orbs**, glowing pulse rings, and responsive cards.

---

## 🏗️ Architecture & Tech Stack

```
+---------------------------------------------------------------------------------+
|                                 FRONTEND                                        |
|      Next.js 15 (App Router) + React 19 + Tailwind CSS + Framer Motion          |
|      Client-side Web Speech API (Low-latency Speech STT & Voice Synthesis)      |
+---------------------------------------------------------------------------------+
                                      |
                              REST APIs & WebSockets
                                      |
+---------------------------------------------------------------------------------+
|                                 BACKEND                                         |
|      FastAPI (Python 3.10+) + Uvicorn Async Server                              |
|      PyTorch (Wav2Vec 2.0 ASR Phoneme Alignment)                                 |
|      SQLite Normalized Database (Schema migrations, JWT auth)                   |
+---------------------------------------------------------------------------------+
                                      |
                              Multi-LLM Fallback Gateway
                                      |
+---------------------------------------------------------------------------------+
|                                 LLM GATEWAY                                     |
|      Gemini 3.5 Flash -> Groq Llama-3 -> OpenAI -> Local Ollama/Mistral        |
+---------------------------------------------------------------------------------+
```

---

## 💻 Local Setup & Installation

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+
- `ffmpeg` installed on system PATH

---

### 1. Backend Setup (FastAPI)

```bash
# Navigate to server directory
cd server

# Create and activate virtual environment
python -m venv .venv

# On Windows (PowerShell):
.venv\Scripts\activate

# On macOS / Linux:
# source .venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Start backend server on port 4000
python -m uvicorn server.main:app --host 0.0.0.0 --port 4000 --reload
```

---

### 2. Frontend Setup (Next.js 15)

```bash
# Navigate to client directory
cd client

# Install Node dependencies
npm install

# Start Next.js development server on port 3000
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 🌐 Production Deployment

Refer to **`deployment_guide.md`** for detailed production instructions:
- **Frontend**: Deploy on **Vercel** or **Cloudflare Pages** (Free HTTPS/SSL for Web Speech API).
- **Backend**: Deploy on **Render.com**, **Railway.app**, **Linux VPS (Ubuntu/Nginx)**, or via **Cloudflare Tunnels (`cloudflared`)**.

---

## 📑 License
MIT License. Built with ❤️ for language learners worldwide.
