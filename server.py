"""
로컬 개발 진입점 — 진본 FastAPI 앱은 api/index.py에 있음.
이 파일은 단순 shim으로, `python server.py`로 실행 시 같은 앱을 8000 포트로 띄움.
배포는 api/index.py가 Vercel Serverless Function으로 직접 실행됨.
"""
from api.index import app  # noqa: F401  (재익스포트 — 외부 ASGI 도구 호환용)

__all__ = ["app"]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.index:app", host="0.0.0.0", port=8000, reload=True)
