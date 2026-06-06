import json

with open("data/raw_iam_data.json", "r") as f:
    users = json.load(f)

analysis = []

for user in users:

    risk_score = 0
    risk_level = "Low"

    # Simple demo logic
    if "admin" in user["UserName"].lower():
        risk_score += 50

    if risk_score >= 50:
        risk_level = "High"
    elif risk_score >= 20:
        risk_level = "Medium"

    analysis.append({
        "UserName": user["UserName"],
        "RiskScore": risk_score,
        "RiskLevel": risk_level
    })

with open("data/analyzed_permissions.json", "w") as f:
    json.dump(analysis, f, indent=4)

print(" Policy analysis completed!")