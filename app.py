from flask import Flask, render_template, jsonify, request
import json
import os
from datetime import datetime
import redis

app = Flask(__name__)

# ==========================================================================
# REDIS CLOUD DATABASE CONFIGURATION
# ==========================================================================
# Grabs the REDIS_URL environment variable you set up on Render.
# Uses secure 'rediss://' prefix to encrypt data traveling over the internet.
REDIS_URL = os.environ.get('REDIS_URL', 'rediss://your-rolled-upstash-url-here')
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

# The single key where your entire leaderboard list is stored inside Redis
REDIS_KEY = "stopwatch_leaderboard"

def load_leaderboard():
    """Load leaderboard from Redis string key"""
    try:
        raw_data = redis_client.get(REDIS_KEY)
        if raw_data:
            return json.loads(raw_data)
        return []
    except Exception as e:
        print(f"Database Read Error: {e}")
        return []

def save_leaderboard(data):
    """Save leaderboard to Redis string key"""
    try:
        redis_client.set(REDIS_KEY, json.dumps(data))
    except Exception as e:
        print(f"Database Write Error: {e}")

def format_time(ms):
    """Convert milliseconds to MM:SS.MS format"""
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
    leaderboard = load_leaderboard()
    return jsonify(leaderboard)

@app.route("/api/save-result", methods=["POST"])
def save_result():
    """Save stopwatch result to leaderboard"""
    try:
        data = request.get_json()
        name = data.get("name", "Unknown").strip()
        question_no = data.get("question_no", "0").strip()
        time_ms = data.get("time_ms", 0)
        lang = data.get("lang", "Unknown")
        
        if not name or time_ms <= 0:
            return jsonify({"status": "error", "message": "Invalid data"}), 400
        
        leaderboard = load_leaderboard()
        
        # Add new entry
        new_entry = {
            "name": name,
            "question_no": question_no,
            "time": format_time(time_ms),
            "time_ms": time_ms,
            "lang": lang,
            "timestamp": datetime.now().isoformat()
        }
        
        leaderboard.append(new_entry)
        
        # Sort by time (fastest first)
        leaderboard.sort(key=lambda x: x["time_ms"])
        
        # Add ranks
        for idx, entry in enumerate(leaderboard):
            entry["rank"] = idx + 1
        
        save_leaderboard(leaderboard)
        
        # Find the specific entry's calculated rank to return safely
        current_rank = next(item["rank"] for item in leaderboard if item["time_ms"] == time_ms and item["name"] == name)
        
        return jsonify({"status": "ok", "entry": new_entry, "rank": current_rank})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/reset", methods=["POST"])
def api_reset():
    """Clear all leaderboard data"""
    try:
        # Deletes the string key entirely out of the cache database instance
        redis_client.delete(REDIS_KEY)
        return jsonify({"status": "ok", "message": "Leaderboard cleared."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)