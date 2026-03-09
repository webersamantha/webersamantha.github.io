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
