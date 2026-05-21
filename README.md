# Megatron Debugger — Leaderboard UI

Stark white/black minimalist FPV-style debugging leaderboard.
Built with Flask + Jinja2 templates + vanilla JS.

## Local development

```bash
pip install -r requirements.txt
python app.py
# → http://localhost:5000
```

## Deploy to Render

1. Push this folder to a GitHub repo.
2. Go to https://render.com → New Web Service.
3. Connect your repo. Render auto-detects `render.yaml`.
4. Build command : `pip install -r requirements.txt`
5. Start command : `gunicorn app:app`
6. Click **Deploy**.

## Project structure

```
megatron_debugger/
├── app.py               # Flask routes + leaderboard data
├── requirements.txt
├── Procfile             # gunicorn start command
├── render.yaml          # Render deploy config
├── templates/
│   └── index.html       # Jinja2 template
└── static/
    ├── css/style.css
    └── js/main.js
```

## Features
- Live stopwatch (Start / Stop via Select button)
- Personal best tracking with flash animation
- Language toggle (C / Python) with status feedback
- Leaderboard row navigation (Prev / Next)
- System clock in footer
- REST API: GET /api/leaderboard  POST /api/reset
