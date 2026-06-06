import json
from datetime import datetime

with open("data/raw_iam_data.json", "r") as f:
    users = json.load(f)

usage_data = []

for user in users:
    usage_data.append({
        "UserName": user["UserName"],
        "LastUsed": "Unknown",
        "DaysUnused": 0,
        "Status": "Active"
    })

with open("data/usage_tracking.json", "w") as f:
    json.dump(usage_data, f, indent=4)

print(" Usage tracking completed!")