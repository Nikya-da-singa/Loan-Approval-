"""Aggregations that power the Dashboard tab."""
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, roc_curve
from sklearn.model_selection import train_test_split

from . import config as C
from .preprocess import add_features

_df = None
_roc = None

FILTER_COLUMNS = {"loan_purpose": "loan_purpose", "employment": "employment", "property_area": "property_area"}
CREDIT_BINS = [0, 599, 649, 699, 749, 1000]
CREDIT_LABELS = ["Below 600", "600–649", "650–699", "700–749", "750+"]
INCOME_BINS = [-1, 25000, 50000, 75000, 100000, 150000, 1e9]
INCOME_LABELS = ["<25k", "25–50k", "50–75k", "75k–1L", "1L–1.5L", "1.5L+"]


def _data() -> pd.DataFrame:
    global _df
    if _df is None:
        _df = pd.read_csv(C.DATA_PATH)
    return _df


def options() -> dict:
    df = _data()
    return {k: sorted(df[col].dropna().unique().tolist()) for k, col in FILTER_COLUMNS.items()}


def _rates(df: pd.DataFrame, col, order=None) -> dict:
    if len(df) == 0:
        return {"labels": order or [], "rate": [0] * len(order or []), "count": [0] * len(order or [])}
    g = df.groupby(col, observed=True)[C.TARGET].agg(["mean", "count"])
    if order is not None:
        g = g.reindex(order).fillna(0)
    return {
        "labels": [str(i) for i in g.index],
        "rate": [round(float(v) * 100, 1) for v in g["mean"]],
        "count": [int(c) for c in g["count"]],
    }


def summary(filters: dict) -> dict:
    df = _data()
    for key, val in filters.items():
        col = FILTER_COLUMNS.get(key)
        if col and val and val != "All":
            df = df[df[col] == val]

    n = len(df)
    if n == 0:
        return {"empty": True, "n": 0}

    biz = df[df["loan_purpose"] == "Business"]
    credit_band = pd.cut(df["credit_score"], CREDIT_BINS, labels=CREDIT_LABELS)
    income_band = pd.cut(df["applicant_income"], INCOME_BINS, labels=INCOME_LABELS)
    d = df.assign(credit_band=credit_band)

    ct = pd.crosstab(income_band, df[C.TARGET]).reindex(INCOME_LABELS, fill_value=0)
    ct = ct.reindex(columns=[0, 1], fill_value=0)

    approved = int(df[C.TARGET].sum())
    return {
        "empty": False,
        "n": n,
        "kpis": {
            "applicants": n,
            "approval_rate": round(float(df[C.TARGET].mean()) * 100, 1),
            "avg_income": round(float(df["applicant_income"].mean())),
            "avg_credit": round(float(df["credit_score"].mean())),
            "business_rate": round(float(biz[C.TARGET].mean()) * 100, 1) if len(biz) else None,
            "business_n": int(len(biz)),
        },
        "credit": _rates(d, "credit_band", CREDIT_LABELS),
        "employment": _rates(df, "employment", ["Salaried", "Self-Employed", "Business Owner"]),
        "purpose": _rates(df, "loan_purpose", ["Home", "Business", "Education", "Personal"]),
        "area": _rates(df, "property_area", ["Urban", "Semiurban", "Rural"]),
        "income": {"labels": INCOME_LABELS, "approved": ct[1].astype(int).tolist(), "rejected": ct[0].astype(int).tolist()},
        "status": {"approved": approved, "rejected": n - approved},
    }


def roc_data() -> list:
    """ROC curve for every model on the held-out test set (same split as training)."""
    global _roc
    if _roc is not None:
        return _roc
    bundle = joblib.load(C.MODEL_PATH)
    df = pd.read_csv(C.DATA_PATH)
    X, y = df[C.RAW_FEATURES], df[C.TARGET]
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=C.RANDOM_STATE)
    X_test = add_features(X_test)
    out = []
    for name, pipe in bundle["models"].items():
        proba = pipe.predict_proba(X_test)[:, 1]
        fpr, tpr, _ = roc_curve(y_test, proba)
        idx = np.unique(np.linspace(0, len(fpr) - 1, 60).astype(int))
        out.append({
            "model": name,
            "auc": round(float(roc_auc_score(y_test, proba)), 3),
            "points": [{"x": round(float(fpr[i]), 4), "y": round(float(tpr[i]), 4)} for i in idx],
        })
    _roc = out
    return out
