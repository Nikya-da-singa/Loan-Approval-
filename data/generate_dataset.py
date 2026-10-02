"""
Generates a realistic, India-flavoured loan application dataset (loan_data.csv).

Why synthetic?  Real bank data is confidential.  This generator encodes the same
rules a credit officer uses (credit score, income vs EMI, existing obligations,
loan size vs income ...) plus random noise, so ML models have real patterns to learn.

Want to use a real dataset instead?  Download the Kaggle "Loan Approval Prediction"
dataset, rename its columns to match src/config.py (or edit config.py) and replace
data/loan_data.csv.  Everything else keeps working.

Run:  python data/generate_dataset.py
"""
import numpy as np
import pandas as pd
from pathlib import Path

rng = np.random.default_rng(42)
N = 3000

age = rng.integers(21, 63, N)
education = rng.choice(["Graduate", "Not Graduate"], N, p=[0.68, 0.32])
employment = rng.choice(["Salaried", "Self-Employed", "Business Owner"], N, p=[0.55, 0.25, 0.20])
property_area = rng.choice(["Urban", "Semiurban", "Rural"], N, p=[0.42, 0.35, 0.23])
dependents = rng.choice([0, 1, 2, 3], N, p=[0.38, 0.27, 0.25, 0.10])
loan_purpose = rng.choice(["Home", "Business", "Education", "Personal"], N, p=[0.30, 0.28, 0.17, 0.25])

# Monthly income in INR (log-normal, shifted by education / employment)
base = rng.lognormal(mean=10.55, sigma=0.55, size=N)
base *= np.where(education == "Graduate", 1.25, 0.85)
base *= np.where(employment == "Business Owner", 1.20, np.where(employment == "Self-Employed", 1.0, 1.05))
applicant_income = np.clip(base, 12000, 400000).round(-2)

has_co = rng.random(N) < 0.42
coapplicant_income = np.where(has_co, np.clip(rng.lognormal(10.2, 0.5, N), 8000, 200000), 0).round(-2)

# Credit score (CIBIL style 300-900), better for higher income / older applicants
cs = rng.normal(690, 75, N) + (np.log(applicant_income) - 10.6) * 25 + (age - 40) * 0.4
credit_score = np.clip(cs, 300, 900).round().astype(int)

existing_emi = np.where(rng.random(N) < 0.55,
                        applicant_income * rng.uniform(0.05, 0.45, N), 0).round(-2)

loan_term = rng.choice([60, 120, 180, 240, 300, 360], N, p=[0.12, 0.12, 0.18, 0.20, 0.13, 0.25])

# Loan amount in lakh INR, scaled to purpose and income
purpose_mult = pd.Series(loan_purpose).map({"Home": 55, "Business": 32, "Education": 18, "Personal": 9}).values
total_income = applicant_income + coapplicant_income
loan_amount = np.clip(total_income / 1000 * rng.uniform(0.35, 1.6, N) * purpose_mult / 40, 0.5, 150).round(1)

# ---------- ground-truth approval logic (what a credit officer cares about) ----------
rate = 0.095 / 12
emi_new = loan_amount * 1e5 * rate / (1 - (1 + rate) ** (-loan_term))
dti = (emi_new + existing_emi) / total_income  # debt-to-income

score = (
    (credit_score - 650) / 55
    - 4.2 * (dti - 0.38)
    + 0.35 * (education == "Graduate")
    + 0.30 * (employment == "Salaried")
    + 0.15 * (employment == "Business Owner")
    + 0.20 * (property_area == "Semiurban")
    - 0.12 * dependents
    + 0.30 * (coapplicant_income > 0)
    + 0.20 * (loan_purpose == "Business") * (credit_score > 700)   # supports entrepreneurs with good history
    - 0.03 * np.maximum(0, age - 55)
    + rng.normal(0, 0.9, N)   # real life is noisy
)
approved = (score > 0.15).astype(int)

df = pd.DataFrame({
    "age": age,
    "education": education,
    "employment": employment,
    "property_area": property_area,
    "dependents": dependents,
    "loan_purpose": loan_purpose,
    "applicant_income": applicant_income.astype(int),
    "coapplicant_income": coapplicant_income.astype(int),
    "existing_emi": existing_emi.astype(int),
    "credit_score": credit_score,
    "loan_amount_lakh": loan_amount,
    "loan_term_months": loan_term,
    "loan_status": approved,
})

# a little missing data so the pipeline's imputers have something to do
for col in ["education", "employment", "credit_score", "applicant_income"]:
    df.loc[rng.random(N) < 0.015, col] = np.nan

out = Path(__file__).parent / "loan_data.csv"
df.to_csv(out, index=False)
print(f"Saved {len(df)} rows -> {out}   approval rate = {df.loan_status.mean():.1%}")
