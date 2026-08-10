# Tomogarden 🌱 Plant Pals

A cute little tracker for our Jonestown, TX garden — live weather alerts, care cards for every plant, and an AI-powered photo "Plant Check."

**Live site:** https://tomogarden.netlify.app

## How the site works

- **`public/index.html`** — the whole website lives in this one file (the page, the styles, and the plant data). Edit it to change anything you see on the site.
- **`public/ogimage.jpg`** — the picture that shows up when you share the link in texts or social media.
- **`netlify/functions/`** — two tiny "serverless functions" that run on Netlify and power the AI features:
  - `diagnose.mjs` — the Plant Check photo doctor (tap the 🔍 on any plant card)
  - `plant-info.mjs` — the AI gardener that fills in the Add-a-plant form when it doesn't recognize a plant name
- **`netlify.toml`** — tells Netlify to publish the `public` folder and where the functions live.

The AI features use the **Netlify AI Gateway** (Claude models), so there are no API keys to manage — Netlify handles it automatically and the usage is billed as Netlify credits.

## Making changes

1. Edit `public/index.html` (or any other file).
2. Commit and push to the `main` branch.
3. That's it — Netlify sees the push and updates the live site in about a minute.

In the terminal, that looks like:

```bash
git add -A
git commit -m "Describe what you changed"
git push
```

## Running the site on your computer

```bash
npm install        # first time only
npm run dev        # starts the site at http://localhost:8888
```

`npm run dev` uses the Netlify CLI, so the AI features work locally too.

## Weather

The weather bar and freeze/rain/heat alerts come free from [Open-Meteo](https://open-meteo.com/) — no key needed. The location is set near the top of the `<script>` in `index.html` (`LAT`, `LON`, `PLACE`).

## Notes for later

- A GPT image API key is saved as a GitHub repo variable called `GPT` — handy if we ever want to generate matching plant illustrations or a new share image.
- Plant photos in the care cards load from Wikimedia Commons.
