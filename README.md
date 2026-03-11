# Samantha Weber Website

Portfolio website with:
- Static frontend (GitHub Pages)
- Publications chatbot (RAG backend over local PDF corpus)
- Project case-study pages

## Repository Structure

```text
website/
  index.html
  styles.css
  script.js
  assistant.js
  projects/
  publications/
  rag-backend/
  render.yaml
```

## Frontend (Local Development)

```bash
cd website
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Publications Chatbot

The chat UI is embedded in the frontend and calls the backend API configured in:

```html
<meta name="chat-api-url" content="https://.../api/chat" />
```

Current production endpoint:

`https://webersamantha-publications-chat.onrender.com/api/chat`

### Build Corpus

```bash
cd rag-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt
python tools/build_corpus.py
```

Generates: `rag-backend/data/corpus.json`

### Run Backend Locally

```bash
cd rag-backend
npm install
cp .env.example .env
# set OPENAI_API_KEY in .env
npm run dev
```

API endpoints:
- `GET /api/health`
- `POST /api/chat`

### Chatbot Scope

The chatbot is retrieval-grounded and intentionally constrained:
- Answers are based only on the uploaded publication corpus.
- If evidence is insufficient, it returns a scope message instead of guessing.
- Answers include citations when relevant evidence is found.

## Deployment

### Frontend (GitHub Pages)

Deploy from `main` branch, folder `/ (root)`.

### Backend (Render)

This repo includes `render.yaml` for Render Blueprint deployment.

Required environment variables:
- `OPENAI_API_KEY`
- `ALLOWED_ORIGINS` (include `https://webersamantha.github.io`)

Optional:
- `OPENAI_MODEL` (default: `gpt-4.1-mini`)
- `CORPUS_PATH` (default: `./data/corpus.json`)

## Maintenance

When publication PDFs are added or changed:
1. Rebuild corpus: `python tools/build_corpus.py`
2. Redeploy backend

If backend URL changes:
1. Update `chat-api-url` meta tag in `index.html`
2. Deploy frontend
