"""Mock Interview routes: start, get questions, answer, and summary."""

import sqlite3
import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from ..db import get_db
from ..deps import get_current_user
from ..converters.stt import transcribe_audio_bytes
from ..analytics import calculate_metrics, is_likely_english
from ..llm import call_local_mistral
from ..auth import new_id

router = APIRouter(prefix="/api/interview", tags=["interview"])

class InterviewStartRequest(BaseModel):
    company: str
    role: str
    difficulty: str

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

@router.post("/start")
def start_interview(
    payload: InterviewStartRequest,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, str]:
    interview_id = new_id()
    started_at = _now_iso()
    
    conn.execute(
        """
        INSERT INTO mock_interviews (id, user_id, company, role, difficulty, started_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (interview_id, user["id"], payload.company, payload.role, payload.difficulty, started_at)
    )
    
    # Generate 3 custom questions using LLM (or fallback)
    prompt = (
        f"You are a professional HR interviewer. Generate exactly 3 technical or behavioral interview questions "
        f"for a '{payload.role}' position at '{payload.company}' (difficulty: {payload.difficulty}). "
        f"Format the output as a simple list with one question per line, no numbering, no preamble, and no explanation."
    )
    
    questions = []
    response = call_local_mistral(prompt)
    if response:
        # Split lines and filter empty/numbered prefixes
        lines = [re.sub(r'^\d+\.\s*', '', l.strip()) for l in response.split("\n") if l.strip()]
        questions = [l for l in lines if len(l) > 15][:3]
        
    # Fallback to standard questions if LLM failed
    if len(questions) < 3:
        questions = [
            f"Tell me about yourself and why you want to join {payload.company} as a {payload.role}.",
            "Describe a challenging project you worked on and how you resolved the obstacles.",
            "Explain how you prioritize tasks when working on multiple tight deadlines."
        ]
        
    categories = ["Introduction", "Behavioral", "Technical/Situation"]
    for i, q in enumerate(questions):
        conn.execute(
            """
            INSERT INTO mock_interview_questions (id, interview_id, question, category)
            VALUES (?, ?, ?, ?)
            """,
            (new_id(), interview_id, q, categories[i])
        )
        
    return {"interviewId": interview_id}

@router.get("/questions")
def get_questions(
    interviewId: str = Query(...),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> List[Dict[str, str]]:
    # Verify ownership
    interview = conn.execute(
        "SELECT id FROM mock_interviews WHERE id = ? AND user_id = ?",
        (interviewId, user["id"])
    ).fetchone()
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
        
    rows = conn.execute(
        "SELECT id, question, category FROM mock_interview_questions WHERE interview_id = ?",
        (interviewId,)
    ).fetchall()
    
    return [{
        "id": r["id"],
        "question": r["question"],
        "category": r["category"]
    } for r in rows]

@router.post("/answer")
async def submit_answer(
    interviewId: str = Query(...),
    questionId: str = Query(...),
    file: UploadFile = File(...),
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    # Verify owner
    interview = conn.execute(
        "SELECT id FROM mock_interviews WHERE id = ? AND user_id = ?",
        (interviewId, user["id"])
    ).fetchone()
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
        
    q_row = conn.execute(
        "SELECT question FROM mock_interview_questions WHERE id = ? AND interview_id = ?",
        (questionId, interviewId)
    ).fetchone()
    if not q_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found.")
        
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=status.HTTP_400_NOT_FOUND, detail="Empty audio file.")
        
    # Transcription + Duration
    transcript, duration = transcribe_audio_bytes(audio_bytes)
    
    # Calculate real WPM and other metrics
    metrics = calculate_metrics(transcript, duration)
    confidence = int(metrics.get("confidenceScore", 0))
    grammar = min(98, max(40, confidence + 5))
    clarity = min(98, max(40, confidence - 2))
    
    # Generate tailored interview feedback via LLM
    feedback_prompt = (
        f"You are a senior job interviewer. The candidate was asked: \"{q_row['question']}\"\n"
        f"The candidate's spoken answer was: \"{transcript}\"\n"
        "Provide a concise evaluation (1-2 sentences) of their answer, highlighting a strength and a key area of improvement. "
        "Keep it professional and encouraging."
    )
    
    feedback_text = call_local_mistral(feedback_prompt)
    if not feedback_text:
        feedback_text = "Good overall attempt. Try to structure your answer using the STAR method for more impact."
        
    # Save the feedback and score in DB
    conn.execute(
        """
        UPDATE mock_interview_questions
        SET user_transcript = ?,
            grammar_score = ?,
            clarity_score = ?,
            confidence_score = ?,
            feedback = ?
        WHERE id = ? AND interview_id = ?
        """,
        (transcript, grammar, clarity, confidence, feedback_text, questionId, interviewId)
    )
    
    return {
        "id": new_id(),
        "questionId": questionId,
        "transcript": transcript,
        "grammarScore": grammar,
        "clarityScore": clarity,
        "confidenceScore": confidence,
        "feedback": feedback_text,
        "tips": ["Use structural transition words (e.g. First, In addition, Consequently)", "Slow down slightly to sound more clear"]
    }

@router.get("/summary/{interviewId}")
def get_summary(
    interviewId: str,
    user: sqlite3.Row = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
) -> Dict[str, Any]:
    # Verify ownership
    interview = conn.execute(
        "SELECT id, company, role, difficulty FROM mock_interviews WHERE id = ? AND user_id = ?",
        (interviewId, user["id"])
    ).fetchone()
    if not interview:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found.")
        
    q_rows = conn.execute(
        """
        SELECT id, question, category, user_transcript, grammar_score, clarity_score, confidence_score, feedback
        FROM mock_interview_questions
        WHERE interview_id = ?
        """,
        (interviewId,)
    ).fetchall()
    
    feedback_list = []
    total_score = 0
    answered_count = 0
    
    for r in q_rows:
        if r["user_transcript"] is not None:
            ans_score = round((r["grammar_score"] + r["clarity_score"] + r["confidence_score"]) / 3)
            total_score += ans_score
            answered_count += 1
            feedback_list.append({
                "id": "f_" + r["id"][:6],
                "questionId": r["id"],
                "transcript": r["user_transcript"],
                "grammarScore": r["grammar_score"],
                "clarityScore": r["clarity_score"],
                "confidenceScore": r["confidence_score"],
                "feedback": r["feedback"],
                "tips": ["Elaborate slightly more on the results achieved."]
            })
            
    final_score = round(total_score / answered_count) if answered_count > 0 else 0
    
    # Store total score in the mock_interviews table
    conn.execute(
        "UPDATE mock_interviews SET total_score = ? WHERE id = ?",
        (final_score, interviewId)
    )
    
    # Save a practice session summary in the practice_sessions table so it appears in analytics & dashboard!
    if answered_count > 0:
        session_id = interviewId
        conn.execute(
            """
            INSERT OR IGNORE INTO practice_sessions
                (id, user_id, session_type, original_text, corrected_text,
                 metrics_json, language_alert, started_at, ended_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                session_id,
                user["id"],
                "mock_interview",
                f"Completed {interview['company']} mock interview for {interview['role']}.",
                f"Successfully practiced job interview questions for {interview['role']} role at {interview['company']}.",
                json.dumps({
                    "confidenceScore": final_score,
                    "pronunciationScore": final_score,
                    "speakingPaceWpm": 130,
                    "durationSeconds": answered_count * 90,
                }),
                None,
                _now_iso(),
                _now_iso()
            )
        )
        
    return {
        "id": interviewId,
        "totalScore": final_score,
        "questionsAnswered": answered_count,
        "feedback": feedback_list
    }
