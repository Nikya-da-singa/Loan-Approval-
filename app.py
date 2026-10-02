"""
Flask web app for Loan Approval Prediction.

Run:  python app.py      then open http://127.0.0.1:5000
"""
import json
from datetime import datetime

from flask import Flask, jsonify, render_template, request

from src import config as C
from src import dashboard
from src.predict import model_names, predict

app = Flask(__name__)

HISTORY_PATH = C.ROOT / "data" / "prediction_history.json"
HISTORY_LIMIT = 200


def read_history():
    try:
        return json.loads(HISTORY_PATH.read_text())
    except (FileNotFoundError, ValueError):
        return []


def write_history(items):
    HISTORY_PATH.write_text(json.dumps(items[-HISTORY_LIMIT:]))

LIMITS = {
    "age": (18, 75), "dependents": (0, 10), "applicant_income": (0, 5_000_000),
    "coapplicant_income": (0, 5_000_000), "existing_emi": (0, 2_000_000),
    "credit_score": (300, 900), "loan_amount_lakh": (0.1, 1000), "loan_term_months": (6, 480),
}
CHOICES = {
    "education": ["Graduate", "Not Graduate"],
    "employment": ["Salaried", "Self-Employed", "Business Owner"],
    "property_area": ["Urban", "Semiurban", "Rural"],
    "loan_purpose": ["Home", "Business", "Education", "Personal"],
}


def parse_payload(data: dict):
    row = {}
    for key, (lo, hi) in LIMITS.items():
        try:
            val = float(data[key])
        except (KeyError, TypeError, ValueError):
            return None, f"'{key}' is missing or not a number."
        if not lo <= val <= hi:
            return None, f"'{key}' must be between {lo} and {hi}."
        row[key] = val
    for key, allowed in CHOICES.items():
        if data.get(key) not in allowed:
            return None, f"'{key}' must be one of: {', '.join(allowed)}."
        row[key] = data[key]
    if row["applicant_income"] + row["coapplicant_income"] <= 0:
        return None, "Total income must be greater than zero."
    return row, None


@app.route("/")
def index():
    names, best = model_names()
    return render_template("index.html", models=names, best=best)


@app.post("/api/predict")
def api_predict():
    row, err = parse_payload(request.get_json(silent=True) or {})
    if err:
        return jsonify(error=err), 400
    model = (request.get_json() or {}).get("model")
    names, _ = model_names()
    result = predict(row, model if model in names else None)

    history = read_history()
    history.append({
        "time": datetime.now().strftime("%d %b, %H:%M"),
        "age": int(row["age"]), "employment": row["employment"], "purpose": row["loan_purpose"],
        "income": int(row["applicant_income"] + row["coapplicant_income"]),
        "loan": row["loan_amount_lakh"], "credit": int(row["credit_score"]),
        "model": result["model"], "probability": result["probability"], "approved": result["approved"],
    })
    write_history(history)
    return jsonify(result)


@app.post("/api/predict_all")
def api_predict_all():
    row, err = parse_payload(request.get_json(silent=True) or {})
    if err:
        return jsonify(error=err), 400
    names, _ = model_names()
    results = {m: predict(row, m) for m in names}
    return jsonify(results=results)


@app.get("/api/metrics")
def api_metrics():
    return jsonify(json.loads(C.METRICS_PATH.read_text()))


@app.get("/api/dashboard")
def api_dashboard():
    filters = {k: request.args.get(k, "All") for k in dashboard.FILTER_COLUMNS}
    data = dashboard.summary(filters)
    data["options"] = dashboard.options()
    return jsonify(data)


@app.get("/api/roc")
def api_roc():
    return jsonify(dashboard.roc_data())


@app.get("/api/history")
def api_history():
    return jsonify(read_history()[::-1])


@app.delete("/api/history")
def api_history_clear():
    write_history([])
    return jsonify(ok=True)


if __name__ == "__main__":
    if not C.MODEL_PATH.exists():
        raise SystemExit("Model not found. Run:  python -m src.train")
    app.run(debug=True)
