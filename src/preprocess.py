"""Data loading, feature engineering and the sklearn preprocessing pipeline."""
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from . import config as C


def emi(principal_lakh, months, annual_rate=C.ANNUAL_INTEREST):
    """Standard EMI formula: P*r*(1+r)^n / ((1+r)^n - 1). Returns INR per month."""
    r = annual_rate / 12
    months = np.maximum(months, 1)
    return principal_lakh * 1e5 * r / (1 - (1 + r) ** (-months))


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    """Create ratios that credit officers actually look at."""
    df = df.copy()
    df["total_income"] = df["applicant_income"].fillna(0) + df["coapplicant_income"].fillna(0)
    df["new_emi"] = emi(df["loan_amount_lakh"], df["loan_term_months"])
    income = df["total_income"].replace(0, np.nan)
    df["debt_to_income"] = (df["new_emi"] + df["existing_emi"]) / income
    df["loan_to_income"] = df["loan_amount_lakh"] * 1e5 / (income * 12)
    return df


def load_data() -> pd.DataFrame:
    df = pd.read_csv(C.DATA_PATH)
    return add_features(df)


def build_preprocessor() -> ColumnTransformer:
    numeric = Pipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    categorical = Pipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])
    return ColumnTransformer([
        ("num", numeric, C.NUMERIC),
        ("cat", categorical, C.CATEGORICAL),
    ])
