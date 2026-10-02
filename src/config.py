"""Central place for paths, column names and settings."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "data" / "loan_data.csv"
MODEL_PATH = ROOT / "models" / "models.joblib"
METRICS_PATH = ROOT / "models" / "metrics.json"

TARGET = "loan_status"

NUMERIC = [
    "age", "dependents", "applicant_income", "coapplicant_income", "existing_emi",
    "credit_score", "loan_amount_lakh", "loan_term_months",
    # engineered in preprocess.add_features():
    "total_income", "new_emi", "debt_to_income", "loan_to_income",
]
CATEGORICAL = ["education", "employment", "property_area", "loan_purpose"]

# Raw inputs (what the user types in the UI / what the CSV contains)
RAW_FEATURES = [
    "age", "education", "employment", "property_area", "dependents", "loan_purpose",
    "applicant_income", "coapplicant_income", "existing_emi", "credit_score",
    "loan_amount_lakh", "loan_term_months",
]

ANNUAL_INTEREST = 0.095   # assumed bank rate used for EMI estimate
RANDOM_STATE = 42
