import json

with open("data/analyzed_permissions.json", "r") as f:
    users = json.load(f)

risk_report = []

for user in users:

    score = 0

    # Rule 1 - Admin Access
    if user["IsAdmin"]:
        score += 30

    # Rule 2 - MFA Disabled
    if not user["MFAEnabled"]:
        score += 20

    # Rule 3 - User Unused > 90 Days
    if user["UnusedDays"] > 90:
        score += 40

    # Final Status

    if score >= 50:
        status = "Critical"
    elif score >= 20:
        status = "Medium"
    else:
        status = "Low"

    risk_report.append({
        "UserName": user["UserName"],
        "RiskScore": score,
        "Status": status
    })

with open("data/risk_report.json", "w") as f:
    json.dump(risk_report, f, indent=4)

print("Risk report generated successfully!")