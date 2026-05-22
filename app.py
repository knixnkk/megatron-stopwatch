from flask import Flask, render_template, jsonify, request
import os
from datetime import datetime
from pymongo import MongoClient, DESCENDING, ASCENDING
from pymongo.errors import ConfigurationError
import sys

app = Flask(__name__)

MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/megatron_db')

try:
    mongo_client = MongoClient(MONGO_URI)
    try:
        db = mongo_client.get_default_database()
    except ConfigurationError:
        db = mongo_client["megatron_db"]
        
    leaderboard_collection = db["leaderboard"]
    leaderboard_collection.create_index([("time_ms", ASCENDING)])
    print(f"Successfully connected to database: '{db.name}' on Cluster0!")
    
except Exception as e:
    print(f"Database Initialization Critical Error: {e}")
    sys.exit(1)


def get_ranked_leaderboard():
    try:
        entries = list(leaderboard_collection.find({}, {"_id": 0}).sort("time_ms", ASCENDING))
        
        for idx, entry in enumerate(entries):
            entry["rank"] = idx + 1
        return entries
    except Exception as e:
        print(f"Database Read Error: {e}")
        return []


def format_time(ms):
    total_sec = ms / 1000
    minutes = int(total_sec // 60)
    seconds = int(total_sec % 60)
    milliseconds = int(ms % 1000)
    return f"{minutes}:{seconds:02d}.{milliseconds:02d}"


@app.route("/")
def index():
    leaderboard = get_ranked_leaderboard()
    return render_template("index.html", leaderboard=leaderboard)


@app.route("/api/leaderboard")
def api_leaderboard():
    leaderboard = get_ranked_leaderboard()
    return jsonify(leaderboard)


@app.route("/api/save-result", methods=["POST"])
def save_result():
    """Save stopwatch result to leaderboard"""
    try:
        data = request.get_json()
        name = data.get("name", "Unknown").strip()
        question_no = data.get("question_no", "0").strip()
        time_ms = int(data.get("time_ms", 0))
        lang = data.get("lang", "Unknown")
        
        if not name or time_ms <= 0:
            return jsonify({"status": "error", "message": "Invalid data"}), 400
        
        # Prepare document structure
        new_entry = {
            "name": name,
            "question_no": question_no,
            "time": format_time(time_ms),
            "time_ms": time_ms,
            "lang": lang,
            "timestamp": datetime.now().isoformat()
        }
        
        # Insert document into MongoDB Collection
        leaderboard_collection.insert_one(new_entry.copy())
        
        # Pull down updated leaderboard to find this user's current exact rank
        updated_leaderboard = get_ranked_leaderboard()
        
        # Find the specific entry's calculated rank to return safely
        current_rank = next(
            item["rank"] for item in updated_leaderboard 
            if item["time_ms"] == time_ms and item["name"] == name
        )
        
        return jsonify({"status": "ok", "entry": new_entry, "rank": current_rank})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/reset", methods=["POST"])
def api_reset():
    """Clear all leaderboard data"""
    try:
        # Deletes every document out of the collection
        leaderboard_collection.delete_many({})
        return jsonify({"status": "ok", "message": "Leaderboard cleared."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)