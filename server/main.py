import os
import sys

# Ensure cache directories are redirected on Windows if D: drive exists
if os.name == "nt" and os.path.exists("D:\\"):
    os.environ.setdefault("HF_HOME", r"D:\.cache\huggingface")
    os.environ.setdefault("TRANSFORMERS_CACHE", r"D:\.cache\huggingface")
    os.environ.setdefault("TORCH_HOME", r"D:\.cache\torch")
    os.environ.setdefault("XDG_CACHE_HOME", r"D:\.cache")
    try:
        os.makedirs(r"D:\.cache", exist_ok=True)
    except Exception:
        pass

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(SERVER_DIR)
if PARENT_DIR not in sys.path:
    sys.path.insert(0, PARENT_DIR)
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

try:
    from server.migrations import run_migrations
    from server.db import _connect
    from server.routes import auth as auth_routes
    from server.routes import practice as practice_routes
    from server.routes import dashboard as dashboard_routes
    from server.routes import profile as profile_routes
    from server.routes import settings as settings_routes
    from server.routes import vocabulary as vocabulary_routes
    from server.routes import partner as partner_routes
    from server.routes import interview as interview_routes
    from server.routes import challenge as challenge_routes
    from server.routes import analytics as analytics_routes
    from server.routes import reports as reports_routes
    from server.routes import streaming as streaming_routes
except (ModuleNotFoundError, ImportError):
    from migrations import run_migrations
    from db import _connect
    from routes import auth as auth_routes
    from routes import practice as practice_routes
    from routes import dashboard as dashboard_routes
    from routes import profile as profile_routes
    from routes import settings as settings_routes
    from routes import vocabulary as vocabulary_routes
    from routes import partner as partner_routes
    from routes import interview as interview_routes
    from routes import challenge as challenge_routes
    from routes import analytics as analytics_routes
    from routes import reports as reports_routes
    from routes import streaming as streaming_routes



app = FastAPI(title='ConviAI Backend')

# CORS — allow local dev servers, Cloudflare Workers/Pages, and Render backend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://model-vani-six.vercel.app',
        'https://model-vani.onrender.com',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.on_event('startup')
def _on_startup() -> None:
    """Run schema migrations once on boot."""
    conn = _connect()
    try:
        run_migrations(conn)
    finally:
        conn.close()


# --------------------------- Routers ---------------------------
app.include_router(auth_routes.router)
app.include_router(practice_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(profile_routes.router)
app.include_router(settings_routes.router)
app.include_router(vocabulary_routes.router)
app.include_router(partner_routes.router)
app.include_router(interview_routes.router)
app.include_router(challenge_routes.router)
app.include_router(analytics_routes.router)
app.include_router(reports_routes.router)
app.include_router(streaming_routes.router)


# --------------------------- Legacy endpoints ---------------------------

@app.get('/api/health')
def health_check():
    return {'status': 'ok', 'message': 'Vani AI backend is running.'}



if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=4000, reload=True)
