# Publications RAG Backend

This backend powers the website chatbot with retrieval over local PDFs in `../publications`.

## 1) Build the corpus from PDFs

From website root:

```bash
cd rag-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt
python tools/build_corpus.py
```

This creates `rag-backend/data/corpus.json`.

## 2) Run API locally

```bash
cd rag-backend
npm install
cp .env.example .env
# add OPENAI_API_KEY in .env
npm run dev
```

API endpoints:
- `GET /api/health`
- `POST /api/chat`

## 3) Connect website frontend

In `index.html`, set this meta tag to your backend URL:

```html
<meta name="chat-api-url" content="https://YOUR-BACKEND-URL/api/chat" />
```

For local testing, use:

```html
<meta name="chat-api-url" content="http://localhost:8787/api/chat" />
```

## 4) Deploy backend

Deploy `rag-backend` to any Node host (Render, Railway, Fly.io, etc.) with environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `ALLOWED_ORIGINS` (include `https://webersamantha.github.io`)
- `PORT` (provided by host)
- `CORPUS_PATH=./data/corpus.json`

Important: after adding new PDFs, rebuild `data/corpus.json` and redeploy.
