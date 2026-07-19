"""WebSocket route: /ws/stt — live streaming STT for real-time subtitles.

Client protocol (JSON over the wire):

  client -> server:
    {"type": "start", "userId": "..."}                 # begin a session
    {"type": "chunk", "data": "<base64 audio bytes>"}   # append media
    {"type": "stop"}                                    # finalize & close

  server -> client:
    {"type": "ready"}                                   # session is open
    {"type": "partial", "text": "...", "duration": 1.2} # partial transcript
    {"type": "final",   "text": "...", "segments": []}  # final transcript
    {"type": "error", "message": "..."}                 # something went wrong

The server pushes a `partial` roughly every 1.2 s while the user is
speaking. The client renders the latest partial as a live caption, then
swaps in the `final` text when the user stops.
"""

import asyncio
import base64
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

try:
    from server.auth import decode_token
    from server.services.streaming_stt import StreamState, stream_transcripts
except (ImportError, ModuleNotFoundError):
    from auth import decode_token
    from services.streaming_stt import StreamState, stream_transcripts

logger = logging.getLogger(__name__)

router = APIRouter(tags=["streaming"])


def _resolve_user_id(token: Optional[str]) -> Optional[str]:
    """Best-effort user-id lookup from a bearer token.

    Streaming is open to anyone for the demo, but if the client sends a
    valid token we record the user id so the RAG store can keep the
    session attached to the right person.
    """
    if not token:
        return None
    try:
        payload = decode_token(token)
    except Exception:
        return None
    if not payload or "sub" not in payload:
        return None
    return str(payload["sub"])


@router.websocket("/ws/stt")
async def ws_stt(websocket: WebSocket) -> None:
    await websocket.accept()
    state = StreamState()
    pump_task: Optional[asyncio.Task] = None

    async def emit(payload: dict) -> None:
        try:
            await websocket.send_json(payload)
        except Exception:
            # Client likely disconnected.
            state.closed = True

    try:
        # First message must be a `start` (with optional token).
        first_raw = await websocket.receive_text()
        try:
            first = json.loads(first_raw)
        except json.JSONDecodeError:
            await emit({"type": "error", "message": "Expected JSON."})
            await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
            return

        if first.get("type") != "start":
            await emit({"type": "error", "message": "First message must be {type: 'start'}."})
            await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
            return

        state.user_id = _resolve_user_id(first.get("token"))
        await emit({"type": "ready", "userId": state.user_id})

        # Start the partial-transcript pump.
        pump_task = asyncio.create_task(stream_transcripts(state, emit))

        # Read messages until the client sends `stop` or disconnects.
        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await emit({"type": "error", "message": "Invalid JSON."})
                continue

            mtype = msg.get("type")
            if mtype == "chunk":
                b64 = msg.get("data", "")
                try:
                    chunk = base64.b64decode(b64) if b64 else b""
                except Exception:
                    await emit({"type": "error", "message": "Invalid base64 chunk."})
                    continue
                # Decoding is fast but still IO-ish — do it off the event loop.
                await asyncio.to_thread(state.add_chunk, chunk)
            elif mtype == "stop":
                break
            elif mtype == "ping":
                await emit({"type": "pong"})
            else:
                await emit({"type": "error", "message": f"Unknown message type '{mtype}'."})

    except WebSocketDisconnect:
        logger.info("ws/stt: client disconnected")
    except Exception as exc:
        logger.exception("ws/stt: unexpected error: %s", exc)
        try:
            await emit({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        state.closed = True
        if pump_task is not None:
            # Give the pump a beat to emit the final transcript, then cancel if still running.
            try:
                await asyncio.wait_for(pump_task, timeout=3.0)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pump_task.cancel()
        try:
            await websocket.close()
        except Exception:
            pass
