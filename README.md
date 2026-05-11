<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MindShelf

A local-first media link library for saving YouTube, Instagram, and web references.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

The local dev server serves the Vite app and the `/api/scrape` endpoint from `server.ts`.

## Deploy to Vercel

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Use the default Vite settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Deploy.

The Vercel serverless function for link scraping is in `api/scrape.ts`, and `vercel.json` rewrites non-API routes back to the Vite app.
