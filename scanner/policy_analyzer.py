import json

with open("data/raw_iam_data.json", "r") as f:
    users = json.load(f)

analysis = []

for user in users:

    is_admin = False
    mfa_enabled = True
    unused_days = 0

    username = user["UserName"]

    # Demo Rules

    if "admin" in username.lower():
        is_admin = True

    analysis.append({
        "UserName": username,
        "IsAdmin": is_admin,
        "MFAEnabled": mfa_enabled,
        "UnusedDays": unused_days
    })

with open("data/analyzed_permissions.json", "w") as f:
    json.dump(analysis, f, indent=4)

print("Policy analysis completed!")