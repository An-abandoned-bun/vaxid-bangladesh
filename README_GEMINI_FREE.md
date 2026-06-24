# VaxID Gemini Free Backend Patch

This patch adds a real Gemini API backend without Firebase Cloud Functions.

Why Cloudflare Worker?
- It has a free plan.
- It gives a free workers.dev URL.
- Your Gemini API key stays hidden as a Worker secret.

Files:
- cloudflare-worker/worker.js: paste this into a Cloudflare Worker.
- public/app.js: replaces your current frontend JS.
- public/ai-config.js: paste your Worker URL here.

Setup summary:
1. Create a Gemini API key in Google AI Studio.
2. Create a free Cloudflare Worker.
3. Paste cloudflare-worker/worker.js into the Worker editor.
4. Add a Worker secret named GEMINI_API_KEY.
5. Copy your Worker URL.
6. Upload this patch to Cloud Shell and unzip it inside your VaxID folder.
7. Edit public/ai-config.js and paste the Worker URL.
8. Deploy Firebase Hosting again.
