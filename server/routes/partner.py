"""Speaking Partner routes: GET topics, GET history, POST message, GET tips."""

import json
import re
import sqlite3
from datetime import datetime, timezone

from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..db import get_db
from ..deps import get_current_user
from ..llm import call_local_mistral
from ..auth import new_id
from ..services import rag_coaching

router = APIRouter(prefix="/api/partner", tags=["partner"])

class PartnerMessageRequest(BaseModel):
    message: str
    topicId: str | None = None

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# Recurring-mistake tracker: simple in-memory frequency table. Persists for
# the lifetime of the process. Cleared on server restart — fine for the
# demo. The real RAG handles long-term memory.
_TIP_RULES = {
    r"\bi\s+has\b": "Use 'I have' instead of 'I has' (subject-verb agreement).",
    r"\bthey\s+was\b": "Use 'they were' instead of 'they was' (subject-verb agreement).",
    r"\bshe\s+go\b": "Past tense of 'go' is 'went' — 'she went', not 'she go'.",
    r"\bhe\s+go\b": "Past tense of 'go' is 'went' — 'he went', not 'he go'.",
    r"\bi\s+have\s+went\b": "After 'have' use the past participle 'gone' — 'I have gone'.",
    r"\btheir\s+is\b": "Use 'there is' for existence (not 'their is').",
    r"\bits\s+a\s+(good|great|nice)\s+day\b": "It's (contraction of 'it is') — not 'its' for possession.",
    r"\bdid\s+not\s+went\b": "After 'did not' use the base form: 'did not go', not 'did not went'.",
    r"\bmore\s+better\b": "'Better' is already comparative — use 'better', not 'more better'.",
    r"\bcan\s+be\s+able\s+to\b": "Pick one: 'can' or 'is able to', not 'can be able to'.",
    r"\bthe\s+both\b": "Drop 'the' before 'both' — say 'both of us', not 'the both of us'.",
    r"\bvery\s+unique\b": "'Unique' is absolute — drop 'very'.",
}


HINDI_WORDS_PATTERN = re.compile(
    r"\b(kaise|kya|haan|naam|aap|hai|hu|bhai|karo|kaha|phir|accha|acha|namaste|shukriya|mujhe|mera|tum|tumhara|kaisa|main|bol|raha|rahi|samajh|nhi|nahi|matlab|kuch|chahiye|pata|chalo|yaha|waha|sab)\b",
    re.IGNORECASE,
)
DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]+")
FILLER_PATTERNS = [
    r"\bum\b", r"\buh\b", r"\ber\b", r"\bah\b", r"\blike\b",
    r"\byou know\b", r"\bbasically\b", r"\bactually\b", r"\bso\b",
    r"\bi mean\b", r"\bright\b", r"\bhonestly\b", r"\bliterally\b"
]


def _detect_non_english(text: str) -> tuple[bool, List[str]]:
    found = []
    if DEVANAGARI_PATTERN.search(text):
        found.append("Devanagari script")

    matches = HINDI_WORDS_PATTERN.findall(text)
    if matches:
        found.extend(list(set(m.lower() for m in matches)))

    return bool(found), found


def _detect_recurring_tips(text: str) -> List[str]:
    """Match a message against the small rule table and return matching tips."""
    lower = text.lower()
    tips: List[str] = []
    for pattern, tip in _TIP_RULES.items():
        if re.search(pattern, lower):
            tips.append(tip)
    return tips


_ENGAGING_FALLBACK_QUESTIONS = {
    "t1": {
        "easy": [
            "What's one dream country you'd love to visit first, and what would you pack?",
            "Do you prefer relaxing on a quiet beach or exploring a bustling city full of sights?",
            "What's the best local food or dish you've ever tried while traveling?"
        ],
        "medium": [
            "If you could move to any country in the world for one year, where would you go and how would your daily life change?",
            "Tell me about a memorable travel trip or adventure you had. What made it special?",
            "Would you rather travel back in time to experience ancient history or travel 100 years into the future?"
        ],
        "hard": [
            "Do you think tourism brings more positive economic growth or negative cultural distortion to local communities?",
            "How has modern technology changed the way we experience travel compared to past generations?",
            "If global travel became eco-restricted, how should humanity balance environmental preservation with cultural exchange?"
        ]
    },
    "t2": {
        "easy": [
            "What is your favorite app on your smartphone that you can't live without?",
            "Do you prefer working on a laptop or using a mobile phone for daily tasks?",
            "What's a cool piece of technology you wish existed right now?"
        ],
        "medium": [
            "How has artificial intelligence or automation impacted your daily routine or study habits so far?",
            "If you had to give up all social media for 30 days, how do you think your mental focus and relationships would change?",
            "What do you think smart cities will look like 20 years from now?"
        ],
        "hard": [
            "As AI becomes more human-like, where should society draw the ethical line between human intuition and machine decision-making?",
            "Do you believe data privacy is still possible in the digital age, or have we permanently traded privacy for convenience?",
            "Will technological automation create more meaningful jobs or accelerate workforce inequality in the next decade?"
        ]
    },
    "default": {
        "easy": [
            "What's one thing that made you smile or feel good today?",
            "If you had a completely free weekend with no obligations, how would you spend it?",
            "What's a hobby or skill you've always wanted to learn?"
        ],
        "medium": [
            "If you could have a one-hour conversation with anyone in history, who would it be and what would you ask them?",
            "What is a lesson or piece of advice you learned recently that changed your perspective?",
            "What do you think is the key quality that makes a person great at communicating with others?"
        ],
        "hard": [
            "What do you believe is the most important challenge facing our generation, and how can individuals contribute to solving it?",
            "Is true success defined by individual achievements or by the positive impact one leaves on society?",
            "How can people maintain strong human connections in an increasingly digital and fast-paced world?"
        ]
    }
}


def _get_difficulty_level(turn_count: int) -> tuple[str, str, str]:
    """Return (difficulty_level, difficulty_label, prompt_directive)."""
    if turn_count <= 3:
        level = "easy"
        label = "🌱 Easy (Warm-up)"
        directive = (
            "DIFFICULTY LEVEL: EASY (Warm-up stage). "
            "Keep your response friendly, enthusiastic, and easy to understand. "
            "Ask a simple, fun, everyday warm-up question related to the topic that gets the user comfortable talking."
        )
    elif 4 <= turn_count <= 6:
        level = "medium"
        label = "🚀 Medium (Expressive)"
        directive = (
            "DIFFICULTY LEVEL: MEDIUM (Expressive & Narrative stage). "
            "Encourage the user to share a personal experience, a story, or a detailed opinion. "
            "Ask an open-ended question starting with 'How do you feel about...', 'Can you describe a time when...', or 'What would you do if...'."
        )
    else:
        level = "hard"
        label = "🔥 Hard (Deep-Thought)"
        directive = (
            "DIFFICULTY LEVEL: HARD (Advanced Deep-Thought & Debate stage). "
            "Challenge the user with an insightful, thought-provoking question involving trade-offs, ethical dilemmas, or future predictions. "
            "Use richer vocabulary and encourage them to explain their reasoning deeply."
        )

    return level, label, directive


def _clean_llm_response(text: str) -> str:
    if not text:
        return text

    cleaned = text.strip()
    patterns = [
        r"^[\s\?\*\"]*\(.*?\)\s*\*?",
        r"^[\s\?\*]*[A-Za-z/\s]+\s*reply:\*?",
        r"^[\s\?\*]*Empathy[^\n]*:\*?",
        r"^[\s\?\*]*Refining[^\n]*:\*?",
        r"^[\s\?\*]*Assistant:\s*",
        r"^[\s\?\*]*AI Partner:\s*",
        r"^[\s\?\*]*Tutor:\s*",
    ]
    for p in patterns:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()

    cleaned = re.sub(r"^[*\?\"\s:]+", "", cleaned).strip()

    if cleaned.startswith('"') and cleaned.endswith('"'):
        cleaned = cleaned[1:-1].strip()

    return cleaned if cleaned else text


@router.get("/topics")
def get_topics() -> List[Dict[str, str]]:
    return [
        { "id": "t1", "label": "Travel", "emoji": "✈️" },
        { "id": "t2", "label": "Technology", "emoji": "💡" },
        { "id": "t3", "label": "Food", "emoji": "🍜" },
        { "id": "t4", "label": "Movies", "emoji": "🎬" },
        { "id": "t5", "label": "Career", "emoji": "💼" },
    ]


@router.get("/history")
def get_history(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> List[Dict[str, Any]]:
    rows = conn.execute(
        "SELECT id, role, content, created_at FROM partner_messages WHERE user_id = ? ORDER BY created_at ASC",
        (user["id"],)
    ).fetchall()

    if not rows:
        greeting_id = new_id()
        created_at = _now_iso()
        greeting_text = "Hi! I'm Vani, your AI Voice Partner. What would you like to talk about today?"
        conn.execute(
            "INSERT INTO partner_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (greeting_id, user["id"], "assistant", greeting_text, created_at)
        )
        return [{
            "id": greeting_id,
            "role": "assistant",
            "content": greeting_text,
            "createdAt": created_at
        }]


    return [{
        "id": r["id"],
        "role": r["role"],
        "content": _clean_llm_response(r["content"]),
        "createdAt": r["created_at"]
    } for r in rows]


@router.post("/message")
def send_message(
    payload: PartnerMessageRequest,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    user_msg_text = payload.message.strip()
    if not user_msg_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    user_msg_id = new_id()
    user_created_at = _now_iso()

    conn.execute(
        "INSERT INTO partner_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_msg_id, user["id"], "user", user_msg_text, user_created_at)
    )

    # Count user turns & determine difficulty level
    user_turn_count = conn.execute(
        "SELECT COUNT(*) FROM partner_messages WHERE user_id = ? AND role = 'user'",
        (user["id"],)
    ).fetchone()[0]

    diff_level, diff_label, diff_directive = _get_difficulty_level(user_turn_count)

    has_non_english, non_english_words = _detect_non_english(user_msg_text)

    history_rows = conn.execute(
        "SELECT role, content FROM partner_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 8",
        (user["id"],)
    ).fetchall()

    rag_ctx = rag_coaching.coaching_context(user["id"], user_msg_text, k=2)

    dialog = []
    for hr in history_rows:
        dialog.append(f"{hr['role'].capitalize()}: {_clean_llm_response(hr['content'])}")

    detected_tips = _detect_recurring_tips(user_msg_text)
    tip_block = ""
    if detected_tips:
        tip_block = (
            "\n\nGrammar patterns detected in the user's last message — gently "
            "mention one at the very end, on a new line:\n- "
            + "\n- ".join(detected_tips)
        )

    lang_warning_block = ""
    if has_non_english:
        lang_warning_block = (
            f"\n\nCRITICAL NOTE: The user used non-English/Hindi word(s) ({', '.join(non_english_words)}). "
            "Gently remind them in English: 'Please speak strictly in English so we can practice effectively!'"
        )

    rag_block = ""
    if rag_ctx:
        rag_block = (
            "\n\nThe user has practiced these phrases recently — use them as "
            "context for a more personalized reply:\n" + rag_ctx
        )

    system_instruction = (
        "You are Vani, an empathetic, curious, and engaging AI English speaking partner and coach. "
        "Keep the conversation natural, friendly, interactive, and fun. "

        "Reply in 1 to 3 short sentences maximum. "
        f"\n\n{diff_directive}\n"
        "Always end your reply with an engaging, creative follow-up question related to the topic that invites the user to speak more. "
        "CRITICAL: Output ONLY the direct response to the user. Do NOT include any thought processes, headers, labels like 'Friendly reply:', or '(3 sentences)'."
        f"{tip_block}{lang_warning_block}{rag_block}"
    )

    prompt = f"{system_instruction}\n\n" + "\n".join(dialog) + "\nAssistant:"

    assistant_reply = _clean_llm_response(call_local_mistral(prompt))
    if not assistant_reply or len(assistant_reply) < 15:
        topic_key = payload.topicId if payload.topicId in _ENGAGING_FALLBACK_QUESTIONS else "default"
        q_list = _ENGAGING_FALLBACK_QUESTIONS.get(topic_key, _ENGAGING_FALLBACK_QUESTIONS["default"]).get(diff_level, _ENGAGING_FALLBACK_QUESTIONS["default"]["easy"])
        import random
        fallback_q = random.choice(q_list)
        assistant_reply = f"That's a great point! {fallback_q}"

    if detected_tips and "💡" not in assistant_reply:
        assistant_reply = assistant_reply.rstrip()
        assistant_reply += "\n\n💡 " + detected_tips[0]

    assistant_msg_id = new_id()
    assistant_created_at = _now_iso()

    conn.execute(
        "INSERT INTO partner_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (assistant_msg_id, user["id"], "assistant", assistant_reply, assistant_created_at)
    )

    try:
        rag_coaching.store_session(
            user_id=user["id"],
            session_id=user_msg_id,
            session_type="speaking_partner",
            transcript=user_msg_text,
            corrected=user_msg_text,
            metrics={},
            created_at=user_created_at,
        )
    except Exception:
        pass

    return {
        "id": assistant_msg_id,
        "role": "assistant",
        "content": assistant_reply,
        "createdAt": assistant_created_at,
        "tips": detected_tips,
        "languageAlert": has_non_english,
        "detectedNonEnglishWords": non_english_words,
        "turnCount": user_turn_count,
        "difficultyLevel": diff_level,
        "difficultyLabel": diff_label,
    }


@router.post("/session/stop")

def stop_partner_session(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    """Finalize speaking partner session and return comprehensive feedback."""
    user_rows = conn.execute(
        "SELECT content, created_at FROM partner_messages WHERE user_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 30",
        (user["id"],)
    ).fetchall()

    if not user_rows:
        return {
            "id": new_id(),
            "score": 80,
            "fluencyScore": 80,
            "fillerCount": 0,
            "fillerBreakdown": {},
            "languageAlertsCount": 0,
            "grammarErrors": [],
            "durationSeconds": 60,
            "totalWords": 0,
            "coachingTips": ["Great start! Speak more sentences to get detailed analytics."]
        }

    total_words = 0
    filler_count = 0
    filler_breakdown: Dict[str, int] = {}
    language_alerts_count = 0
    grammar_errors: List[Dict[str, str]] = []

    for r in user_rows:
        text = r["content"]
        words = text.split()
        total_words += len(words)

        lower = text.lower()
        for fp in FILLER_PATTERNS:
            matches = re.findall(fp, lower)
            if matches:
                clean_f = fp.replace(r"\b", "").replace(r"\\", "")
                cnt = len(matches)
                filler_count += cnt
                filler_breakdown[clean_f] = filler_breakdown.get(clean_f, 0) + cnt

        has_non_eng, _ = _detect_non_english(text)
        if has_non_eng:
            language_alerts_count += 1

        tips = _detect_recurring_tips(text)
        for t in tips:
            if not any(g["tip"] == t for g in grammar_errors):
                grammar_errors.append({
                    "original": text[:100],
                    "tip": t
                })

    base_score = 95
    base_score -= min(30, filler_count * 2)
    base_score -= min(25, language_alerts_count * 5)
    base_score -= min(25, len(grammar_errors) * 5)
    final_score = max(45, min(98, base_score))

    fluency_score = max(45, min(98, 95 - (filler_count * 3)))

    coaching_tips = []
    if filler_count > 3:
        top_filler = list(filler_breakdown.keys())[0] if filler_breakdown else "um"
        coaching_tips.append(f"Try pausing briefly instead of using filler words like '{top_filler}'.")
    if language_alerts_count > 0:
        coaching_tips.append(f"Detected non-English words {language_alerts_count} time(s). Keep practicing strictly in English.")
    if grammar_errors:
        coaching_tips.append(grammar_errors[0]["tip"])
    if not coaching_tips:
        coaching_tips.append("Excellent conversation! Your sentence flow and vocabulary were clear.")

    session_id = new_id()
    now_iso = _now_iso()
    dur_sec = max(30, total_words * 2)

    conn.execute(
        """
        INSERT INTO practice_sessions
            (id, user_id, session_type, original_text, corrected_text, metrics_json, started_at, ended_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id,
            user["id"],
            "speaking_partner",
            f"Partner Session ({len(user_rows)} turns)",
            f"Partner Session completed with score {final_score}%",
            json.dumps({
                "confidenceScore": final_score,
                "pronunciationScore": fluency_score,
                "speakingPaceWpm": min(160, max(90, total_words * 2)),
                "fillerCount": filler_count,
                "wordsSpoken": total_words,
                "durationSeconds": dur_sec
            }),
            now_iso,
            now_iso
        )
    )

    return {
        "id": session_id,
        "score": final_score,
        "fluencyScore": fluency_score,
        "fillerCount": filler_count,
        "fillerBreakdown": filler_breakdown,
        "languageAlertsCount": language_alerts_count,
        "grammarErrors": grammar_errors,
        "durationSeconds": dur_sec,
        "totalWords": total_words,
        "coachingTips": coaching_tips
    }



@router.post("/session/reset")
def reset_partner_session(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    """Delete history of speaking partner messages for this user to restart fresh."""
    conn.execute(
        "DELETE FROM partner_messages WHERE user_id = ?",
        (user["id"],)
    )
    # Insert new greeting
    greeting_id = new_id()
    created_at = _now_iso()
    greeting_text = "Hi! I'm Vani, your AI Voice Partner. What would you like to talk about today?"
    conn.execute(
        "INSERT INTO partner_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (greeting_id, user["id"], "assistant", greeting_text, created_at)
    )
    return {
        "status": "ok",
        "greeting": greeting_text
    }


@router.get("/tips")
def get_user_tips(
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> List[Dict[str, Any]]:
    counts: Dict[str, int] = {}
    examples: Dict[str, str] = {}

    pm_rows = conn.execute(
        "SELECT content FROM partner_messages WHERE user_id = ? AND role = 'user' ORDER BY created_at DESC LIMIT 100",
        (user["id"],)
    ).fetchall()
    ps_rows = conn.execute(
        "SELECT original_text FROM practice_sessions WHERE user_id = ? AND original_text IS NOT NULL ORDER BY started_at DESC LIMIT 50",
        (user["id"],)
    ).fetchall()

    for row in list(pm_rows) + list(ps_rows):
        try:
            text = row["content"]
        except (IndexError, KeyError):
            try:
                text = row["original_text"]
            except (IndexError, KeyError):
                text = ""
        for tip in _detect_recurring_tips(text):
            counts[tip] = counts.get(tip, 0) + 1
            examples.setdefault(tip, text[:80])

    out = [
        {"tip": tip, "count": cnt, "example": examples[tip]}
        for tip, cnt in sorted(counts.items(), key=lambda kv: -kv[1])
    ]
    return out

