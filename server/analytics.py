"""Speech metrics — words, filler counts, real WPM from audio duration.

All calculations work from raw text and a real `duration_seconds` returned by
the STT module. When duration is 0 (e.g. text-only input), we estimate
duration as words / 150 wpm so the WPM fallback isn't a constant 12s stub.
"""

import re
from typing import Optional

# Filler words are kept as a small list so we can flag obvious disfluencies
# in addition to spaCy / language-tool findings.
FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'so', 'actually', 'basically', 'right', 'okay']
COMMON_ENGLISH_WORDS = {
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with',
    'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
    'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
    'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
    'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
    'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
    'any', 'these', 'give', 'day', 'most', 'us',
    # Expanded list for robust local checks
    'is', 'am', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'do', 'does', 'did', 'done',
    'hello', 'hi', 'hey', 'name', 'name\'s', 'suramati', 'bholo', 'please', 'talk', 'speak',
    'english', 'yes', 'no', 'thank', 'thanks', 'welcome', 'today', 'yesterday', 'tomorrow'
}


def normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text.strip())


def count_words(text: str) -> int:
    return len([word for word in normalize_text(text).split(' ') if word])


def calculate_filler_count(text: str) -> int:
    lower = text.lower()
    return sum(
        len(re.findall(rf'\b{re.escape(filler)}\b', lower))
        for filler in FILLER_WORDS
    )


def _safe_duration(duration_seconds: Optional[float], words: int) -> float:
    """Pick a usable duration — never zero, never negative."""
    if duration_seconds and duration_seconds > 0:
        return float(duration_seconds)
    # Fallback: assume 150 wpm when no audio duration is available.
    return max(1.0, words / 150.0 * 60.0)


def estimate_pace(words: int, duration_seconds: float = 0.0) -> str:
    """Compute WPM from real audio duration. Clamp 40–250 to filter outliers."""
    if duration_seconds <= 0:
        return '0 wpm'
    minutes = duration_seconds / 60.0
    pace = min(max(round(words / minutes), 40), 250)
    return f'{pace} wpm'


def pace_wpm(words: int, duration_seconds: float) -> int:
    """Numeric WPM — used by callers that need an int (analytics, dashboards)."""
    if words <= 0:
        return 0
    duration = _safe_duration(duration_seconds, words)
    return min(max(int(round((words / duration) * 60)), 0), 250)


def estimate_confidence(text: str, filler_count: int) -> int:
    """Confidence score (0-100) derived from word count and filler density."""
    words = count_words(text)
    if words == 0:
        return 30
    base = min(max(round((words / 20) * 10 + 50), 40), 90)
    penalty = min(filler_count * 4, 30)
    return max(10, base - penalty)


def is_likely_english(text: str) -> bool:
    words = [word for word in re.sub(r'[^a-z\s]', ' ', text.lower()).split(' ') if word]
    if not words:
        return False
    english_count = sum(1 for word in words if word in COMMON_ENGLISH_WORDS)
    ratio = english_count / len(words)
    if ratio >= 0.15:
        return True
        
    # Hybrid check: fallback to cloud LLM query for 100% accuracy on proper nouns/short sentences
    try:
        from .llm import call_local_mistral
    except ImportError:
        try:
            from llm import call_local_mistral
        except ImportError:
            return False
            
    prompt = (
        f"Is the following transcription text primarily written in English? "
        f"Text: \"{text}\" "
        f"Reply only 'Yes' or 'No' without punctuation."
    )
    res = call_local_mistral(prompt)
    if res and 'yes' in res.strip().lower():
        return True
    return False


def calculate_metrics(
    text: str,
    duration_seconds: float = 0.0,
    speech_duration_seconds: Optional[float] = None,
    pause_count: int = 0,
) -> dict:
    """Compute the full set of practice metrics.

    `duration_seconds` is the *audio* duration from STT; `speech_duration_seconds`
    and `pause_count` are optional extra fields the STT pipeline can provide
    via `transcribe_audio_full`. When omitted they default to None / 0 and the
    caller still gets word/pace/filler/confidence.
    """
    normalized = normalize_text(text)
    words_spoken = count_words(normalized)
    filler_count = calculate_filler_count(normalized)
    safe_dur = _safe_duration(duration_seconds, words_spoken)

    out: dict = {
        'fillerCount': filler_count,
        'estimatedPace': estimate_pace(words_spoken, safe_dur),
        'confidenceScore': estimate_confidence(normalized, filler_count),
        'wordsSpoken': words_spoken,
        'durationSeconds': safe_dur,
    }
    if speech_duration_seconds is not None:
        out['speechDurationSeconds'] = float(speech_duration_seconds)
    if pause_count:
        out['pauseCount'] = int(pause_count)
    return out
