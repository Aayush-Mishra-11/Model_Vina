import os
import re
import logging
from dotenv import load_dotenv
import requests

load_dotenv()
logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'mistral')
LOCAL_MISTRAL_URL = os.getenv('LOCAL_MISTRAL_URL', 'http://localhost:8080/v1/chat/completions')
LOCAL_MISTRAL_MODEL = os.getenv('LOCAL_MISTRAL_MODEL', 'mistral-7b-instruct')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
GROQ_API_KEY = os.getenv('GROQ_API_KEY')


def _extract_original_text(prompt: str) -> str:
    m = re.search(r'Original:\s*"([\s\S]+?)"', prompt)
    if not m:
        m = re.search(r'Sentence:\s*"([\s\S]+?)"', prompt)
    return m.group(1) if m else prompt


def _offline_improve_text(prompt: str) -> str:
    # 1. If it expects JSON (like interview feedback), return a mock JSON string
    if "Format the output strictly as a JSON object" in prompt:
        return '{"feedback": "Good attempt! Work on structuring your response with clearer examples.", "grammar_score": 75, "clarity_score": 70, "confidence_score": 75}'
        
    # 2. If it's a conversation partner prompt, return a conversational fallback
    if "empathetic, encouraging AI English speaking partner" in prompt:
        return "That's interesting! Tell me more about that."
        
    # 3. If it's a storytelling challenge, return a challenge feedback fallback
    if "You are an AI English tutor. The user completed a storytelling challenge" in prompt:
        return "Great story! Your vocabulary was good and the flow was easy to follow."

    # 4. Standard text correction extraction
    text = _extract_original_text(prompt)
    # Check if the extracted text is still the prompt (extraction failed)
    if text == prompt:
        lines = [line.strip() for line in prompt.split('\n') if line.strip()]
        for line in reversed(lines):
            if line.startswith("User:"):
                text = line[len("User:"):].strip()
                break
            elif line.startswith("Original:"):
                text = line[len("Original:"):].strip()
                break

    fillers = [r'\bum\b', r'\buh\b', r'\blike\b', r'you know', r'\bso\b', r'\bactually\b', r'\bbasically\b']
    cleaned = text
    for f in fillers:
        cleaned = re.sub(f, '', cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
    if cleaned and cleaned[-1] not in '.!?':
        cleaned = cleaned + '.'
    return cleaned


def _parse_llm_response(data):
    if not isinstance(data, dict):
        return None

    if 'choices' in data and isinstance(data['choices'], list) and data['choices']:
        first = data['choices'][0]
        if isinstance(first, dict):
            message = first.get('message')
            if isinstance(message, dict):
                return message.get('content')
            if message is not None:
                return str(message)
            if first.get('text') is not None:
                return str(first.get('text'))
        return str(first)

    if 'output' in data:
        output = data['output']
        if isinstance(output, list) and output:
            first = output[0]
            if isinstance(first, dict):
                if first.get('content') is not None:
                    return str(first.get('content'))
                if first.get('text') is not None:
                    return str(first.get('text'))
            return str(first)
        if isinstance(output, str):
            return output

    if 'text' in data:
        return str(data['text'])

    return None


def _send_request(url: str, payload: dict):
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException:
        return None


def _ollama_urls() -> list[str]:
    """Return a prioritized list of Ollama endpoint URLs to try.

    Handles three URL conventions the operator may use:
      - Native:        http://host:11434           → /api/chat, /api/generate
      - OpenAI-compat: http://host:11434/v1        → /v1/chat/completions
      - Explicit:      http://host:11434/api/chat  → used verbatim
    """
    raw = OLLAMA_URL.rstrip('/')
    if raw.endswith('/v1') or raw.endswith('/v1/'):
        return [f'{raw}/chat/completions']
    if '/api/chat' in raw or '/api/generate' in raw:
        return [raw]
    return [f'{raw}/api/chat', f'{raw}/api/generate', f'{raw}/v1/chat/completions']


def _try_ollama_chat(prompt: str):
    payload = {
        'model': OLLAMA_MODEL,
        'messages': [
            {
                'role': 'system',
                'content': 'You are an English communication coach. Improve user text for professional English speaking.'
            },
            {
                'role': 'user',
                'content': prompt
            }
        ],
        'temperature': 0.45,
        'max_tokens': 260
    }

    for url in _ollama_urls():
        data = _send_request(url, payload)
        if data:
            result = _parse_llm_response(data)
            if result:
                return result
    return None


def _try_ollama_generate(prompt: str):
    raw = OLLAMA_URL.rstrip('/')
    if '/api/chat' in raw or '/v1/' in raw:
        # Already covered by the chat path
        return None
    url = f'{raw}/api/generate'

    payload = {
        'model': OLLAMA_MODEL,
        'prompt': prompt,
        'temperature': 0.45,
        'max_tokens': 260
    }
    data = _send_request(url, payload)
    if data:
        return _parse_llm_response(data)
    return None


def _try_local_mistral(prompt: str):
    payload = {
        'model': LOCAL_MISTRAL_MODEL,
        'messages': [
            {
                'role': 'system',
                'content': 'You are an English communication coach. Improve user text for professional English speaking.'
            },
            {
                'role': 'user',
                'content': prompt
            }
        ],
        'temperature': 0.45,
        'max_tokens': 260
    }
    data = _send_request(LOCAL_MISTRAL_URL, payload)
    if data:
        result = _parse_llm_response(data)
        if result:
            return result
    return None


def _try_gemini(prompt: str) -> str | None:
    if not GEMINI_API_KEY:
        return None
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.45,
            "maxOutputTokens": 500
        }
    }
    try:
        response = requests.post(url, json=payload, timeout=20)
        response.raise_for_status()
        res_json = response.json()
        text = res_json['candidates'][0]['content']['parts'][0]['text']
        return text.strip()
    except Exception as e:
        logger.warning(f"Gemini API call failed: {e}")
        return None


def _try_groq(prompt: str) -> str | None:
    if not GROQ_API_KEY:
        return None
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {
                "role": "system",
                "content": "You are an English communication coach. Improve user text for professional English speaking. Reply ONLY with the improved sentence, no explanations."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.45,
        "max_tokens": 500
    }
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        res_json = response.json()
        return res_json['choices'][0]['message']['content'].strip()
    except Exception as e:
        logger.warning(f"Groq API call failed: {e}")
        return None


def _try_openai(prompt: str) -> str | None:
    if not OPENAI_API_KEY:
        return None
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "You are an English communication coach. Improve user text for professional English speaking. Reply ONLY with the improved sentence, no explanations."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "temperature": 0.45,
        "max_tokens": 500
    }
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        res_json = response.json()
        return res_json['choices'][0]['message']['content'].strip()
    except Exception as e:
        logger.warning(f"OpenAI API call failed: {e}")
        return None


def call_local_mistral(prompt: str) -> str:
    # 1. Try cloud APIs first if configured
    gemini_resp = _try_gemini(prompt)
    if gemini_resp:
        return gemini_resp.strip()

    groq_resp = _try_groq(prompt)
    if groq_resp:
        return groq_resp.strip()

    openai_resp = _try_openai(prompt)
    if openai_resp:
        return openai_resp.strip()

    # 2. Try Ollama first, then fallback to a generic local Mistral-compatible endpoint.
    ollama_response = _try_ollama_chat(prompt)
    if not ollama_response:
        ollama_response = _try_ollama_generate(prompt)
    if ollama_response:
        return ollama_response.strip()

    mistral_response = _try_local_mistral(prompt)
    if mistral_response:
        return mistral_response.strip()

    return _offline_improve_text(prompt)
