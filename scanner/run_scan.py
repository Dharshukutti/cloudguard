import os

print("Starting CloudGuard Scan...\n")

os.system("python scanner/iam_collector.py")
os.system("python scanner/policy_analyzer.py")
os.system("python scanner/usage_tracker.py")
os.system("python scanner/risk_scorer.py")

print("\n Full Scan Completed!")