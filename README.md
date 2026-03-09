# Samantha Website (GitHub Pages)

This is a static site ready for GitHub Pages.

## Local preview

Open `index.html` directly, or run a simple server:

```bash
cd website
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Publish on GitHub Pages

1. Create a GitHub repo.
   - For a personal root site: `yourusername.github.io`
   - For a project site: any repo name, e.g. `portfolio`
2. Push this folder's contents to the repo root.
3. In GitHub: `Settings` -> `Pages`
4. Under **Build and deployment**:
   - Source: `Deploy from a branch`
   - Branch: `main` and folder `/ (root)`
5. Save.

Your site URL will be:
- Root site: `https://yourusername.github.io`
- Project site: `https://yourusername.github.io/reponame`

## Personalize

Update these placeholders in `index.html`:
- `samantha@example.com`
- `https://github.com/yourusername`
- `https://www.linkedin.com/in/yourprofile`
- Project card links and descriptions

## Publications Chatbot (RAG)

The website now includes a `Chat` section that calls a backend API.

1. Build the publication corpus:

```bash
cd rag-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r tools/requirements.txt
python tools/build_corpus.py
```

2. Start backend locally:

```bash
cd rag-backend
npm install
cp .env.example .env
# add OPENAI_API_KEY in .env
npm run dev
```

3. Point the website to the backend by editing this in `index.html`:

```html
<meta name="chat-api-url" content="http://localhost:8787/api/chat" />
```

4. For production:
- Deploy `rag-backend` to a Node host.
- Set `ALLOWED_ORIGINS=https://webersamantha.github.io`.
- Change the same meta tag to your deployed backend URL.

## Render Deployment (No Code Editing)

This repo includes `render.yaml` so deployment is mostly click-through.

1. Push latest code to GitHub.
2. In Render: `New` -> `Blueprint` -> select this GitHub repo.
3. Confirm service name is `webersamantha-publications-chat` (or tell Codex the new URL if Render changes it).
4. In Render service settings, add secret env var:
   - `OPENAI_API_KEY` = your API key
5. Click deploy.

The frontend is already configured to call:

`https://webersamantha-publications-chat.onrender.com/api/chat`
