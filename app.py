from flask import Flask, render_template, jsonify, request
import time

app = Flask(__name__)

LEADERBOARD = [
    {"rank": 1, "handle": "BugHunter_99",   "time": "0:09.12", "lang": "C"},
    {"rank": 2, "handle": "NullPtr_Ace",     "time": "0:11.90", "lang": "Python"},
    {"rank": 3, "handle": "SegFault_King",   "time": "0:14.37", "lang": "C"},
    {"rank": 4, "handle": "H3xD3bugger",     "time": "0:17.55", "lang": "Python"},
    {"rank": 5, "handle": "CoreDump_Pro",    "time": "0:21.08", "lang": "C"},
]

@app.route("/")
def index():
    return render_template("index.html", leaderboard=LEADERBOARD)

@app.route("/api/leaderboard")
def api_leaderboard():
    return jsonify(LEADERBOARD)

@app.route("/api/reset", methods=["POST"])
def api_reset():
    return jsonify({"status": "ok", "message": "Session reset."})

if __name__ == "__main__":
    app.run(debug=True)
