# Megatron Debugger Leaderboard - Setup & Deployment Guide

## Overview

This is a competitive programming stopwatch app with built-in leaderboard tracking. Features include:
- ⏱️ **Stopwatch** - Start/Stop timers with millisecond precision
- 👥 **Leaderboard** - Automatically tracks and ranks results by speed
- 🗂️ **Language Selection** - Toggle between C and Python
- 📝 **Auto-Saving** - Records player name, question number, time, and language
- 💾 **Persistent Storage** - Data survives server restarts

---

## Features Implemented

### 1. Stopwatch Interface
- Large, easy-to-read timer display (M:SS.CS format)
- Green **START** button enables timing
- Red **STOP** button stops timing and opens modal
- Timer runs with 10ms precision

### 2. Modal Form (After Stop)
Pop-up form captures:
- **Player Name** - User's handle/identifier
- **Question No.** - Problem number (Q1, Q2, etc.)
- **Time** - Auto-filled, shows elapsed time
- **Language** - Dropdown (C or Python)

### 3. Leaderboard
- Auto-sorts by fastest time
- Displays: Rank, Name, Language, Question #, Time
- Updates in real-time after each save
- Crown icon (👑) marks #1 rank

### 4. Database Solution

#### ✅ **Recommended: JSON File Storage** (Current Implementation)
- **Pros:**
  - ✅ No external dependencies
  - ✅ Free on Render (no database costs)
  - ✅ Simple, reliable persistence
  - ✅ No SSL/authentication overhead
  - ✅ Survives server restarts

- **Cons:**
  - ❌ Not ideal for 1000+ simultaneous users
  - ❌ No real-time sync between multiple instances
  - ❌ Render free tier has ephemeral file system (data resets on redeploy)

#### Alternative: MongoDB Atlas (Better for Render)
If you need persistent data on Render free tier:

1. **Sign up** at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. **Create free tier cluster** (512MB storage)
3. **Get connection string** (looks like: `mongodb+srv://...`)
4. **Install pymongo:**
   ```bash
   pip install pymongo
   ```
5. **Update `app.py`** to use MongoDB instead of JSON files

---

## Current Architecture

### Backend (Flask)
```
app.py
├── /api/leaderboard - GET leaderboard data
├── /api/save-result  - POST new score
└── /api/reset        - POST clear all data
```

### Frontend (Vanilla JS)
```
static/js/main.js
├── Stopwatch logic (start/stop/format time)
├── Modal form handling
├── AJAX calls to backend
└── Leaderboard refresh
```

### Storage
```
leaderboard_data.json
└── Array of records with: {name, question_no, time, time_ms, lang, rank, timestamp}
```

---

## Deployment to Render.com (Free Tier)

### Step 1: Prepare Your Repository
```bash
git add .
git commit -m "Add stopwatch feature"
git push origin main
```

### Step 2: Create Render Service
1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name:** `megatron-leaderboard`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Instance Type:** Free

### Step 3: Environment Variables (if using MongoDB)
Add in Render dashboard:
```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/leaderboard?retryWrites=true&w=majority
```

### Step 4: Deploy
Click **"Create Web Service"** - Render will deploy automatically

### ⚠️ Important: Ephemeral File System
Render free tier has **ephemeral storage** - files are deleted on redeploy!

#### Solutions:

**Option A: Keep JSON files (Current)**
- Data resets on every redeploy
- Good for testing/demo
- ✅ Zero cost

**Option B: Upgrade to MongoDB** 
- Persistent, cloud-hosted database
- Free tier: 512MB storage (enough for 10K+ records)
- $0.57/month for paid tier (very cheap)
- ✅ Recommended for production

**Option C: Upgrade Render Plan**
- Paid tier ($7+/month) includes persistent storage
- Not necessary if you switch to MongoDB

---

## Using MongoDB Instead of JSON

### Update `app.py`:

```python
from flask import Flask, render_template, jsonify, request
from pymongo import MongoClient
import os
from datetime import datetime

app = Flask(__name__)

# MongoDB Connection
MONGO_URI = os.getenv('DATABASE_URL', 'mongodb://localhost:27017/leaderboard')
client = MongoClient(MONGO_URI)
db = client['leaderboard']
results_collection = db['results']

def load_leaderboard():
    """Load from MongoDB"""
    results = list(results_collection.find({}, {'_id': 0}).sort('time_ms', 1))
    for idx, result in enumerate(results):
        result['rank'] = idx + 1
    return results

def save_result(data):
    """Save to MongoDB"""
    new_record = {
        'name': data['name'],
        'question_no': data['question_no'],
        'time_ms': data['time_ms'],
        'time': format_time(data['time_ms']),
        'lang': data['lang'],
        'timestamp': datetime.now()
    }
    results_collection.insert_one(new_record)
    # Return updated leaderboard
    return load_leaderboard()

def format_time(ms):
    total_sec = ms / 1000
    minutes = int(total_sec // 60)
    seconds = int(total_sec % 60)
    milliseconds = int(ms % 1000)
    return f"{minutes}:{seconds:02d}.{milliseconds:02d}"

@app.route("/")
def index():
    leaderboard = load_leaderboard()
    return render_template("index.html", leaderboard=leaderboard)

@app.route("/api/leaderboard")
def api_leaderboard():
    return jsonify(load_leaderboard())

@app.route("/api/save-result", methods=["POST"])
def api_save_result():
    try:
        data = request.get_json()
        name = data.get("name", "Unknown").strip()
        question_no = data.get("question_no", "0").strip()
        time_ms = data.get("time_ms", 0)
        lang = data.get("lang", "Unknown")
        
        if not name or time_ms <= 0:
            return jsonify({"status": "error", "message": "Invalid data"}), 400
        
        leaderboard = save_result(data)
        
        # Find rank of new entry
        rank = next((idx + 1 for idx, entry in enumerate(leaderboard) 
                    if entry['name'] == name and entry['time_ms'] == time_ms), None)
        
        return jsonify({
            "status": "ok", 
            "entry": leaderboard[-1],
            "rank": rank
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/reset", methods=["POST"])
def api_reset():
    try:
        results_collection.delete_many({})
        return jsonify({"status": "ok", "message": "Leaderboard cleared."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=False, port=int(os.getenv('PORT', 5000)))
```

### Update `requirements.txt`:

```
flask>=3.0.0
gunicorn>=21.2.0
pymongo>=4.0.0
python-dotenv>=0.20.0
```

---

## Testing Locally

### 1. Run development server:
```bash
source venv/bin/activate
python app.py
```

### 2. Visit: `http://localhost:5001`

### 3. Test workflow:
1. Select C or Python
2. Click **START**
3. Wait 3-5 seconds
4. Click **STOP**
5. Fill in name (e.g., "TestUser") and question (e.g., "Q1")
6. Click **SAVE**
7. Verify entry appears in leaderboard
8. Click **RESET** to clear data (optional)

---

## API Reference

### GET `/api/leaderboard`
Returns array of all records sorted by time.

**Response:**
```json
[
  {
    "rank": 1,
    "name": "CodeNinja_99",
    "question_no": "Q1",
    "time": "0:16.19",
    "time_ms": 16190,
    "lang": "C",
    "timestamp": "2026-05-21T23:07:27.123456"
  }
]
```

### POST `/api/save-result`
Saves a new result and returns updated leaderboard.

**Request:**
```json
{
  "name": "CodeNinja_99",
  "question_no": "Q1",
  "time_ms": 16190,
  "lang": "C"
}
```

**Response:**
```json
{
  "status": "ok",
  "entry": { ...record... },
  "rank": 1
}
```

### POST `/api/reset`
Clears all leaderboard data.

**Response:**
```json
{
  "status": "ok",
  "message": "Leaderboard cleared."
}
```

---

## File Structure

```
leaderboard/
├── app.py                    # Flask backend
├── requirements.txt          # Dependencies
├── leaderboard_data.json     # Data storage (generated)
├── Procfile                  # For Heroku/Render
├── render.yaml               # Render config
├── static/
│   ├── css/
│   │   └── style.css         # UI styling
│   └── js/
│       └── main.js           # Frontend logic
└── templates/
    └── index.html            # HTML template
```

---

## Troubleshooting

### Data disappears after Render redeploy?
- Switch to MongoDB (persistent)
- Or use Render paid tier with persistent disk

### "Port already in use" error?
- Change port in `app.py`: `app.run(port=5002)`

### Modal not appearing?
- Check browser console for JavaScript errors
- Verify modal HTML is in `index.html`

### Leaderboard not updating?
- Ensure `/api/save-result` returns `status: ok`
- Check browser Network tab in DevTools

---

## Next Steps

1. ✅ **Test locally** - Complete!
2. ⏭️ **Deploy to Render** - Follow steps above
3. ⏭️ **(Optional) Add MongoDB** - For persistent data
4. ⏭️ **(Optional) Add user authentication** - Prevent cheating
5. ⏭️ **(Optional) Add contest mode** - Time-limited competitions

---

## Questions?

Refer to:
- [Flask docs](https://flask.palletsprojects.com/)
- [Render docs](https://render.com/docs)
- [MongoDB Atlas docs](https://docs.atlas.mongodb.com/)
