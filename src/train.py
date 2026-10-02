"""
Train and compare several classification algorithms.

Run:  python -m src.train
Outputs: models/models.joblib (all fitted pipelines) and models/metrics.json
"""
import json
import time

import joblib
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeClassifier

from . import config as C
from .preprocess import add_features, build_preprocessor, load_data

ALGORITHMS = {
    "Logistic Regression": LogisticRegression(max_iter=1000),
    "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=15),
    "Decision Tree": DecisionTreeClassifier(max_depth=6, min_samples_leaf=20, random_state=C.RANDOM_STATE),
    "Random Forest": RandomForestClassifier(n_estimators=300, max_depth=10, min_samples_leaf=5,
                                            n_jobs=-1, random_state=C.RANDOM_STATE),
    "Gradient Boosting": GradientBoostingClassifier(n_estimators=200, learning_rate=0.08,
                                                    max_depth=3, random_state=C.RANDOM_STATE),
}


def main():
    df = load_data()
    X = df[C.RAW_FEATURES]
    y = df[C.TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=C.RANDOM_STATE)
    print(f"Train: {len(X_train)} rows | Test: {len(X_test)} rows | approval rate {y.mean():.1%}\n")

    fitted, results = {}, []
    for name, clf in ALGORITHMS.items():
        pipe = Pipeline([("prep", build_preprocessor()), ("clf", clf)])
        t0 = time.time()
        Xtr, Xte = add_features(X_train), add_features(X_test)
        pipe.fit(Xtr, y_train)
        pred = pipe.predict(Xte)
        proba = pipe.predict_proba(Xte)[:, 1]
        cv = cross_val_score(pipe, Xtr, y_train, cv=5, scoring="accuracy", n_jobs=-1)
        tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
        row = {
            "model": name,
            "accuracy": round(accuracy_score(y_test, pred), 4),
            "precision": round(precision_score(y_test, pred), 4),
            "recall": round(recall_score(y_test, pred), 4),
            "f1": round(f1_score(y_test, pred), 4),
            "roc_auc": round(roc_auc_score(y_test, proba), 4),
            "cv_accuracy": round(float(cv.mean()), 4),
            "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "train_seconds": round(time.time() - t0, 2),
        }
        results.append(row)
        fitted[name] = pipe
        print(f"{name:22s} acc={row['accuracy']:.3f}  f1={row['f1']:.3f}  auc={row['roc_auc']:.3f}  cv={row['cv_accuracy']:.3f}")

    best = max(results, key=lambda r: (r["roc_auc"], r["f1"]))["model"]
    print(f"\nBest model (by ROC-AUC): {best}")

    # Feature importance from the best tree-based model (Random Forest) for the dashboard
    rf = fitted["Random Forest"]
    names = rf.named_steps["prep"].get_feature_names_out()
    imp = rf.named_steps["clf"].feature_importances_
    # merge one-hot columns back to their parent feature
    merged = {}
    for n, v in zip(names, imp):
        n = n.split("__", 1)[1]
        for cat in C.CATEGORICAL:
            if n.startswith(cat + "_"):
                n = cat
        merged[n] = merged.get(n, 0) + float(v)
    importance = sorted(merged.items(), key=lambda kv: -kv[1])

    metrics = {
        "best_model": best,
        "dataset": {"rows": int(len(df)), "approval_rate": round(float(y.mean()), 4),
                    "train_rows": int(len(X_train)), "test_rows": int(len(X_test))},
        "results": results,
        "feature_importance": [{"feature": k, "importance": round(v, 4)} for k, v in importance],
    }
    C.MODEL_PATH.parent.mkdir(exist_ok=True)
    joblib.dump({"models": fitted, "best": best}, C.MODEL_PATH)
    C.METRICS_PATH.write_text(json.dumps(metrics, indent=2))
    print(f"Saved models -> {C.MODEL_PATH}")


if __name__ == "__main__":
    main()
