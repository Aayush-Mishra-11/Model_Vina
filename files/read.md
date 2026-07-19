Algorithms, Models & Design Decisions — Layer by Layer

  1. 🎙️  Speech-to-Text (STT) — server/converters/stt.py

  Model: OpenAI Whisper, specifically the tiny.en variant.

  ┌──────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │         Spec         │                                                           Value                                                           │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Library              │ openai-whisper (the Python package, not the API)                                                                          │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Architecture         │ Transformer encoder–decoder                                                                                               │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Weights              │ tiny.en — 39M parameters, English-only, ~75 MB download                                                                   │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Other variants       │ tiny, base, small, medium, large, plus .en English-only versions                                                          │
  │ available            │                                                                                                                           │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Why tiny.en          │ Fastest of the family, English-only = no language-detection pass needed, small enough to run on CPU in a few seconds.     │
  │                      │ Tradeoff: worst WER of the family.                                                                                        │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Device               │ CPU (no device="cuda" argument passed)                                                                                    │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Compute type         │ FP32 (default; no fp16 flag)                                                                                              │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Audio input          │ webm/opus from the browser → written to a temp .wav → loaded by ffmpeg → mel spectrogram → Whisper                        │
  ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Decoding args        │ Only language='en' is forced. Default greedy decoder. temperature=0 (default), beam_size=None (greedy), best_of=None. No  │
  │                      │ initial_prompt, no condition_on_previous_text.                                                                            │
  └──────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  Audio pipeline / ffmpeg bootstrap:
  - imageio_ffmpeg.get_ffmpeg_exe() is called on first import. It returns a path to a pre-bundled ffmpeg binary.
  - The code copies that binary into server/converters/ffmpeg.exe (so Whisper can find it locally).
  - Then prepends that directory to os.environ['PATH'] and runs ffmpeg -version to verify it works. This is why the ffmpeg.exe you see in the repo is 84
  MB — it's already been bootstrapped.
  - Why ffmpeg? Whisper's load_audio() requires PCM 16 kHz mono. It shells out to ffmpeg to decode whatever format you give it (webm/opus in this case)
  and resample to 16 kHz mono float32.

  Transcription call:
  result = model.transcribe(temp_path, language='en')
  return result.get('text', '').strip()
  - Returns only the text field of Whisper's result dict (no segment timestamps, no token-level confidence, no language-detection result — the language
  is hard-pinned to en).

  ---
  2. 🧠 LLM / Grammar Correction — server/llm.py

  This is a three-tier fallback chain. They are tried in order, first success wins.

  Tier 1: Ollama chat endpoint

  - Default URL: http://127.0.0.1:11434 (configurable via OLLAMA_URL)
  - If OLLAMA_URL doesn't contain /api/, it tries /api/chat/completions first, then /api/generate as a fallback.
  - Default model: mistral (set via OLLAMA_MODEL).
  - Payload uses the OpenAI-compatible chat format:
  {
    "model": "mistral",
    "messages": [
      {"role": "system", "content": "You are an English communication coach. Improve user text for professional English speaking."},
      {"role": "user", "content": "<the prompt>"}
    ],
    "temperature": 0.45,
    "max_tokens": 260
  }
  - temperature=0.45 — low but not greedy; allows some natural variation while staying close to the input.
  - max_tokens=260 — caps the response to keep things fast and cheap.

  Tier 2: Ollama generate endpoint

  - Same OLLAMA_URL, but the /api/generate route with a single prompt field (not messages).
  - Same model, same temperature, same max_tokens.

  Tier 3: Generic OpenAI-compatible Mistral endpoint

  - URL: http://localhost:8080/v1/chat/completions (configurable via LOCAL_MISTRAL_URL)
  - Model: mistral-7b-instruct (configurable via LOCAL_MISTRAL_MODEL)
  - Same OpenAI chat-completions payload shape as Tier 1.

  Tier 4 (offline regex improver) — llm._offline_improve_text

  Used when no LLM server is reachable. Pure-Python, no model. Algorithm:

  1. Extract the original text from the prompt by regex-matching Original:\s*"<text>".
  2. Remove a hardcoded list of filler words using re.sub with re.IGNORECASE:
  fillers = [r'\bum\b', r'\buh\b', r'\blike\b', r'you know',
             r'\bso\b', r'\bactually\b', r'\bbasically\b']
  3. Collapse whitespace.
  4. Capitalize first character, append . if it doesn't end with .!?.
  5. Return the result. No grammar correction, no rewriting — only filler removal.

  Response parser (_parse_llm_response) handles four different LLM response shapes:
  - OpenAI chat: choices[0].message.content
  - OpenAI legacy: choices[0].text
  - Ollama generate: output[0].content or output[0].text
  - Raw text: top-level text field

  This is the adapter layer that lets the pipeline talk to any of these backends without the caller knowing which one responded.

  ---
  3. 📊 Speech Analytics — server/analytics.py

  All metrics are rule-based, deterministic — no model, no ML. Pure Python + regex.

  3a. Normalization — normalize_text

  re.sub(r'\s+', ' ', text.strip())
  - Collapses any run of whitespace to a single space, then strips ends.

  3b. Word count — count_words

  - Splits on single space, filters out empty strings. Naive — doesn't handle hyphenated words or apostrophes specially.

  3c. Filler word detection — calculate_filler_count

  - For each filler in the hardcoded list ['um', 'uh', 'like', 'you know', 'so', 'actually', 'basically', 'right', 'okay']:
  - Use re.findall(rf'\b{re.escape(filler)}\b', lower_text) to count case-insensitive word-boundary matches.
  - Sum the counts. Problem: like, so, right, actually have legitimate non-filler uses that this will over-count.

  3d. Pace — estimate_pace

  pace = min(max(round((words / 12) * 60), 90), 180)   # wpm
  - Fake WPM. This isn't measuring time — it's assuming a 12-second sample window and projecting to "per minute."
  - Clamped to [90, 180]. So it always returns a number in that range, never 0 (unless input is empty, in which case it returns the literal string "0
  wpm").
  - Why fake? Because there's no timing data in the input — the server only sees the transcript after the user hits Stop. The metric is essentially a
  word count in disguise.

  3e. Confidence — estimate_confidence

  base    = clamp(round(words/20 * 10 + 50), 40, 90)
  penalty = min(filler_count * 4, 30)
  return max(10, base - penalty)
  - Starts at 50, adds up to +40 based on word count (saturates at 90 once you hit ~80 words).
  - Subtracts 4 per filler, capped at -30.
  - Floor of 10. So the score is always 10–90.
  - This is a heuristic formula, not a learned model.

  3f. Language detection — is_likely_english

  - Strips everything that's not a-z or whitespace, lowercases, splits.
  - Looks up each word in a hardcoded set of ~100 common English words (function words: the, be, to, of, and, ...).
  - Returns True if at least 25% of input words are in that set.
  - This is why "I was not prepared" still passed even with a low content-word ratio — the function-word set is generous.
  - This is the weakest part of the system; it has no actual language ID model.

  3g. Metrics aggregator — calculate_metrics

  Just runs the four functions above and returns a dict.

  ---
  4. 🔊 Text-to-Speech (TTS) — server/converters/tts.py

  Engine: pyttsx3 — a Python wrapper around native OS speech engines.

  ┌──────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
  │       Spec       │                                                             Value                                                             │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Library          │ pyttsx3 v2.99                                                                                                                 │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Backend on       │ SAPI 5 (Speech API) — uses built-in Microsoft voices like David, Zira                                                         │
  │ Windows          │                                                                                                                               │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Backend on macOS │ NSSpeechSynthesizer                                                                                                           │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Backend on Linux │ espeak                                                                                                                        │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Rate             │ 160 wpm (set explicitly)                                                                                                      │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Volume           │ 1.0 (max)                                                                                                                     │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Voice selection  │ Iterates engine.getProperty('voices') and picks the first whose id contains en or whose name contains english. Falls back     │
  │                  │ silently if none match.                                                                                                       │
  ├──────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
  │ Output format    │ 16-bit PCM WAV written to a temp file, then read back into bytes                                                              │
  └──────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

  No neural TTS. No Coqui, no XTTS, no Bark, no ElevenLabs. This is the system "robotic" voice that comes with every Windows install.

  ⚠️  Bug noted in my earlier analysis: the result is written into ttsAudio in the pipeline but main.py never returns it to the client and the React UI
  has no <audio> element. So this code runs but nothing is heard.

  ---
  5. 💾 Storage — server/storage.py

  Not a database. Just a JSON file at server/session_store.json with the schema:
  {
    "sessions": [
      {
        "timestamp": "<ISO8601 UTC>",
        "originalText": "...",
        "correctedText": "...",
        "metrics": {...},
        "languageAlert": "..."
      }
    ]
  }

  Concurrency model: record_session does a read-modify-write on the same file with r+ mode, then seek(0) and truncate(). There is no file locking —
  concurrent writes will clobber each other. Fine for single-user demo, broken for any real load.

  No API to read sessions back. load_summary() exists but is never called from any endpoint.

  ---
  6. 🌐 API Layer — server/main.py

  Framework: FastAPI (which is Starlette + Pydantic + type hints).
  ASGI server: Uvicorn.
  CORS: Hardcoded to allow only http://localhost:5173 and http://127.0.0.1:5173. Methods: GET, POST, OPTIONS.

  Endpoints and what each does:

  ┌────────────────────┬────────────────┬──────────────────────────────────────────────────────────┬──────────────────────────────────────┐
  │      Endpoint      │     Method     │                       What it does                       │              Model used              │
  ├────────────────────┼────────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ /api/health        │ GET            │ Returns {"status":"ok"}                                  │ None                                 │
  ├────────────────────┼────────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ /api/transcribe    │ POST multipart │ Audio → transcript + metrics, no LLM                     │ Whisper tiny.en                      │
  ├────────────────────┼────────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ /api/session/audio │ POST multipart │ Full pipeline: STT → lang check → LLM → metrics → record │ Whisper + (Ollama or fallback)       │
  ├────────────────────┼────────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ /api/assistant     │ POST JSON      │ Text → corrected text + metrics + record                 │ LLM (Ollama or fallback) + analytics │
  ├────────────────────┼────────────────┼──────────────────────────────────────────────────────────┼──────────────────────────────────────┤
  │ /api/synthesize    │ POST JSON      │ Text → WAV bytes (streaming)                             │ pyttsx3                              │
  └────────────────────┴────────────────┴──────────────────────────────────────────────────────────┴──────────────────────────────────────┘

  Request/response models — server/models.py:
  - AssistantRequest { text: str }
  - SynthesisRequest { text: str }
  - SessionMetrics { fillerCount, estimatedPace, confidenceScore, wordsSpoken }
  - TranscriptResponse { transcript, languageAlert?, metrics }
  - AssistantResponse { correctedText, metrics, languageAlert? }

  These are Pydantic v2 models — FastAPI uses them for both validation and OpenAPI schema generation.

  ---
  7. 🔁 Pipeline Orchestration — server/pipeline.py

  Two flows, both do the same thing in different orders.

  process_audio_session(audio_bytes):

  1. Whisper STT → transcript string
  2. analytics.calculate_metrics(transcript) → metrics dict
  3. is_likely_english(transcript) branch:
    - No → set languageAlert = "Please use only English in this practice session.", skip LLM, skip TTS, set correctedText = "", ttsAudio = None.
    - Yes → build a prompt and call call_local_mistral(prompt). Then call synthesize_text_to_wav(corrected_text).
  4. record_session(...) — always, regardless of branch.
  5. Return dict.

  process_text_session(text):

  1. Same as above minus the TTS step (no audio in, no TTS out).

  The prompt template is the only place the LLM is told what to do:
  "Please improve the following spoken English for a professional, confident response.
  Correct grammar, remove filler words, enhance vocabulary, and preserve the meaning.
  Original: "<user_text>" Return only the corrected and improved text without explanation."

  System prompt (sent alongside the user prompt to the LLM):
  "You are an English communication coach. Improve user text for professional English speaking."

  These two prompts are identical across both Tier 1 (Ollama chat) and Tier 3 (OpenAI-compat Mistral). Only Tier 2 (/api/generate) uses the user prompt
  alone with no system message.

  ---
  8. 🖥️  Frontend — client/src/

  Stack:
  - React 18.3 with TypeScript 5.7
  - Vite 5.4 as bundler and dev server
  - React Refresh for HMR
  - No router (just a useState toggle between Practice and Dashboard)
  - No state management library (Redux, Zustand, etc.) — just useState and useRef
  - No component library (Material, Chakra, shadcn) — hand-rolled CSS in index.css

  Audio capture — SpeechPractice.tsx

  - Browser API: navigator.mediaDevices.getUserMedia({ audio: true }) to get a mic stream
  - Recorder: MediaRecorder API (browser-native, no library)
  - Format: Whatever the browser default is — typically audio/webm;codecs=opus on Chrome/Edge, audio/ogg;codecs=opus on Firefox. Safari doesn't support
  MediaRecorder for audio in older versions.
  - No compression settings — uses browser defaults (usually Opus at 48 kHz).
  - No real-time partial transcription — records to completion, then uploads.
  - Sends the blob as multipart/form-data to /api/session/audio via fetch.

  Vite proxy — vite.config.ts

  - /api → http://localhost:4000 (HTTP)
  - /ws → ws://localhost:4000 (WebSocket proxy configured but no WS server exists in FastAPI)

  ---
  9. 📋 Summary — Models and Algorithms in One Table

  ┌────────────────────┬────────────────────────────────────────────────────────────────┬──────────────────────────────┬────────────────────────────┐
  │       Layer        │                       Algorithm / Model                        │        Library / File        │    Parameters / Config     │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ STT                │ OpenAI Whisper Transformer (encoder–decoder)                   │ openai-whisper in            │ tiny.en, CPU, FP32,        │
  │                    │                                                                │ converters/stt.py            │ language forced to en      │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Audio              │ ffmpeg                                                         │ imageio_ffmpeg in            │ Bundled binary, 16 kHz     │
  │ decode/resample    │                                                                │ converters/stt.py            │ mono PCM                   │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ LLM (primary)      │ Mistral (Ollama-served)                                        │ requests in llm.py           │ temperature=0.45,          │
  │                    │                                                                │                              │ max_tokens=260             │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ LLM (fallback 1)   │ Mistral via Ollama /api/generate                               │ same                         │ same                       │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ LLM (fallback 2)   │ Mistral-7B-Instruct via OpenAI-compat                          │ same                         │ same                       │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ LLM (offline)      │ Regex filler stripper                                          │ _offline_improve_text in     │ 7 hardcoded regexes        │
  │                    │                                                                │ llm.py                       │                            │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Grammar correction │ Instruction-tuned prompt template                              │ pipeline.py                  │ "improve the following     │
  │  prompt            │                                                                │                              │ spoken English..."         │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Language detection │ Function-word frequency heuristic                              │ is_likely_english in         │ Threshold: 25% of words in │
  │                    │                                                                │ analytics.py                 │  ~100-word set             │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Filler detection   │ Regex word-boundary match                                      │ calculate_filler_count in    │ 9 hardcoded fillers        │
  │                    │                                                                │ analytics.py                 │                            │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Pace estimation    │ Linear formula, clamped                                        │ estimate_pace in             │ (words/12)*60, clamped to  │
  │                    │                                                                │ analytics.py                 │ [90, 180] wpm              │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Confidence scoring │ Linear formula with filler penalty                             │ estimate_confidence in       │ 50 + words/2, −4 per       │
  │                    │                                                                │ analytics.py                 │ filler, [10, 90]           │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ TTS                │ OS-native SAPI 5 (Windows)                                     │ pyttsx3 in converters/tts.py │ Rate 160, vol 1.0, English │
  │                    │                                                                │                              │  voice preference          │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Storage            │ JSON file with RMW                                             │ storage.py                   │ No locking, single file    │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ API framework      │ FastAPI on Uvicorn                                             │ main.py                      │ CORS locked to             │
  │                    │                                                                │                              │ localhost:5173             │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Validation         │ Pydantic v2                                                    │ models.py                    │ camelCase fields           │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Frontend framework │ React 18 + TypeScript 5                                        │ client/src/                  │ Vite, no router, no state  │
  │                    │                                                                │                              │ lib                        │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │ Audio capture      │ MediaRecorder + getUserMedia                                   │ SpeechPractice.tsx           │ Browser-default codec      │
  │                    │                                                                │                              │ (Opus)                     │
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │                    │ TensorFlow, PyTorch directly, HuggingFace transformers,        │                              │                            │
  │ No used            │ langdetect, fasttext, Coqui XTTS, Bark, ElevenLabs,            │ —                            │ —                          │
  │                    │ WebSockets, any database                                       │                              │                            │
  └────────────────────┴────────────────────────────────────────────────────────────────┴──────────────────────────────┴────────────────────────────┘

  ---
  10. Things that are not ML but people often assume are

  - Pace and confidence are pure formulas, not learned metrics. The WPM number is essentially word count in disguise, not an actual speech-rate
  measurement (no audio timing is captured server-side).
  - The language detection is a word-list lookup, not a statistical language model. It cannot tell Hindi from Urdu, can't handle code-switched sentences,
  and will incorrectly mark any sentence with enough English function words as "English."
  - Offline grammar correction is not a model — it's re.sub calls. It cannot reorder clauses, fix subject-verb agreement, or expand vocabulary. It only
  deletes filler words.
  - Whisper is the only true neural model in the entire stack.

  The single biggest leverage point for improving the project (if that's your goal): swap the offline regex improver for an actual grammar-correction
  model (e.g., a small flan-t5-small for grammar error correction, or gec-t5_small, or just a proper Ollama-served model with a better prompt) — that's
  where most of the "missing intelligence" lives.
  ├────────────────────┼────────────────────────────────────────────────────────────────┼──────────────────────────────┼────────────────────────────┤
  │                    │ TensorFlow, PyTorch directly, HuggingFace transformers,        │                              │                            │
  │ No used            │ langdetect, fasttext, Coqui XTTS, Bark, ElevenLabs,            │ —                            │ —                          │
  │                    │ WebSockets, any database                                       │                              │                            │
  └────────────────────┴────────────────────────────────────────────────────────────────┴──────────────────────────────┴────────────────────────────┘

  ---
  10. Things that are not ML but people often assume are

  - Pace and confidence are pure formulas, not learned metrics. The WPM number is essentially word count in disguise, not an actual speech-rate
  measurement (no audio timing is captured server-side).
  - The language detection is a word-list lookup, not a statistical language model. It cannot tell Hindi from Urdu, can't handle code-switched sentences,
  and will incorrectly mark any sentence with enough English function words as "English."
  - Offline grammar correction is not a model — it's re.sub calls. It cannot reorder clauses, fix subject-verb agreement, or expand vocabulary. It only
  deletes filler words.
  - Whisper is the only true neural model in the entire stack.

  The single biggest leverage point for improving the project (if that's your goal): swap the offline regex improver for an actual grammar-correction
  model (e.g., a small flan-t5-small for grammar error correction, or gec-t5_small, or just a proper Ollama-served model with a better prompt) — that's
  where most of the "missing intelligence" lives.