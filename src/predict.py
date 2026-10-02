"""Prediction + a simple, model-agnostic 'why?' explanation."""
import joblib
import pandas as pd

from . import config as C
from .preprocess import add_features, emi

_bundle = None
_baseline = None

FRIENDLY = {
    "credit_score": "Credit score", "applicant_income": "Your income",
    "coapplicant_income": "Co-applicant income", "existing_emi": "Existing EMIs",
    "loan_amount_lakh": "Loan amount", "loan_term_months": "Loan tenure",
    "age": "Age", "dependents": "Dependents", "education": "Education",
    "employment": "Employment type", "property_area": "Property area",
    "loan_purpose": "Loan purpose",
}


def _load():
    global _bundle, _baseline
    if _bundle is None:
        _bundle = joblib.load(C.MODEL_PATH)
        df = pd.read_csv(C.DATA_PATH)[C.RAW_FEATURES]
        base = {}
        for col in C.RAW_FEATURES:
            base[col] = df[col].mode()[0] if col in C.CATEGORICAL else df[col].median()
        _baseline = base
    return _bundle, _baseline


def model_names():
    bundle, _ = _load()
    return list(bundle["models"].keys()), bundle["best"]


def _proba(pipe, row: dict) -> float:
    X = add_features(pd.DataFrame([row])[C.RAW_FEATURES])
    return float(pipe.predict_proba(X)[0, 1])


def predict(row: dict, model_name: str | None = None) -> dict:
    bundle, baseline = _load()
    model_name = model_name or bundle["best"]
    pipe = bundle["models"][model_name]

    p = _proba(pipe, row)

    # What-if explanation: swap each feature for the typical applicant's value
    # and see how the approval probability moves. Positive = this feature helped you.
    factors = []
    for col in C.RAW_FEATURES:
        alt = dict(row)
        alt[col] = baseline[col]
        delta = p - _proba(pipe, alt)
        factors.append({"feature": FRIENDLY[col], "impact": round(delta * 100, 1)})
    factors.sort(key=lambda f: -abs(f["impact"]))

    new_emi = float(emi(row["loan_amount_lakh"], row["loan_term_months"]))
    total_income = row["applicant_income"] + row["coapplicant_income"]
    dti = (new_emi + row["existing_emi"]) / total_income if total_income else 1.0

    tips = []
    if row["credit_score"] < 700:
        tips.append("A credit score above 700 improves approval odds the most. Pay dues on time and keep card usage low.")
    if dti > 0.45:
        tips.append("Your EMIs would take over 45% of income. Try a smaller amount, a longer tenure, or add a co-applicant.")
    if row["coapplicant_income"] == 0 and p < 0.6:
        tips.append("Adding an earning co-applicant strengthens the application.")
    if row["existing_emi"] > 0.3 * row["applicant_income"]:
        tips.append("Closing an existing loan before applying frees up repayment capacity.")
    if not tips and p >= 0.6:
        tips.append("Your profile looks strong. Keep documents (ID, income proof, bank statements) ready.")

    return {
        "model": model_name,
        "probability": round(p, 4),
        "approved": p >= 0.5,
        "risk": "Low" if p >= 0.75 else "Medium" if p >= 0.5 else "High",
        "new_emi": round(new_emi),
        "debt_to_income": round(dti * 100, 1),
        "factors": factors[:6],
        "tips": tips[:3],
    }
