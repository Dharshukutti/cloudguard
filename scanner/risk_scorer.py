import json

with open("data/analyzed_permissions.json", "r") as f:
    users = json.load(f)

risk_report = []

for user in users:

    score = user["RiskScore"]

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

print("Risk report generated!") 