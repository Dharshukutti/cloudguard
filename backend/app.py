from flask import Flask, jsonify
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)


@app.route("/")
def home():
    return jsonify({
        "project": "CloudGuard",
        "status": "Running",
        "phase": "Backend API"
    })


@app.route("/api/dashboard")
def dashboard():

    with open("data/risk_report.json", "r") as f:
        data = json.load(f)

    return jsonify(data)


@app.route("/api/dashboard/summary")
def summary():

    with open("data/risk_report.json", "r") as f:
        data = json.load(f)

    total_users = len(data)

    high_risk = sum(
        1 for user in data
        if user["Status"] == "Critical"
    )

    medium_risk = sum(
        1 for user in data
        if user["Status"] == "Medium"
    )

    low_risk = sum(
        1 for user in data
        if user["Status"] == "Low"
    )

    return jsonify({
        "total_users": total_users,
        "high_risk": high_risk,
        "medium_risk": medium_risk,
        "low_risk": low_risk
    })


@app.route("/api/users")
def users():

    with open("data/risk_report.json", "r") as f:
        data = json.load(f)

    for user in data:

        if user["Status"] == "Critical":
            user["Reason"] = "Admin access or inactive account"

        elif user["Status"] == "Medium":
            user["Reason"] = "Requires security review"

        else:
            user["Reason"] = "MFA enabled and active user"

    return jsonify(data)


@app.route("/api/report")
def report():

    with open("data/risk_report.json", "r") as f:
        data = json.load(f)

    return jsonify({
        "ReportName": "CloudGuard Security Report",
        "TotalUsers": len(data),
        "Users": data
    })


if __name__ == "__main__":
    app.run(debug=True)