import boto3
import json
import os
from dotenv import load_dotenv

load_dotenv()

iam = boto3.client(
    "iam",
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)

users = iam.list_users()

result = []

for user in users["Users"]:
    result.append({
        "UserName": user["UserName"],
        "UserId": user["UserId"],
        "CreateDate": str(user["CreateDate"])
    })

with open("data/raw_iam_data.json", "w") as f:
    json.dump(result, f, indent=4)

print(" IAM data collected successfully!")