# LoanLens – Loan Approval Prediction (ML Mini Project)

Predicts whether a loan application will be approved, with an attractive web UI.
Linked to **UN SDG 8 – Decent Work and Economic Growth** (access to credit, faster and fairer
loan decisions, support for entrepreneurs and small businesses).

## Project structure
```
loan-approval-ml/
├── app.py                  # Flask web server + JSON API
├── requirements.txt
├── data/
│   ├── generate_dataset.py # creates loan_data.csv (3000 applicants, INR)
│   └── loan_data.csv
├── src/
│   ├── config.py           # paths, column names, constants
│   ├── preprocess.py       # feature engineering + sklearn preprocessing pipeline
│   ├── train.py            # trains & compares 5 algorithms, saves models + metrics
│   └── predict.py          # prediction + "what moved the score" explanation
├── models/                 # models.joblib, metrics.json (created by train.py)
├── templates/index.html    # UI (4 tabs: Check eligibility, Dashboard, Model lab, About)
└── static/{css,js}/        # styling, front-end logic, dashboard.js, local Chart.js
```

## Run it
```bash
pip install -r requirements.txt
python -m src.train        # optional: models/ already contains trained models
python app.py              # open http://127.0.0.1:5000
```
To regenerate data: `python data/generate_dataset.py` then retrain.

## Dashboard tab
Filterable KPIs and charts (approval rate by credit score, employment, purpose, area; income vs outcome),
ROC curves for all 5 models, and a live history of every prediction made in the app
(stored in `data/prediction_history.json`, created automatically).

## Algorithms used
Logistic Regression, K-Nearest Neighbors, Decision Tree, Random Forest, Gradient Boosting.
Metrics: accuracy, precision, recall, F1, ROC-AUC, 5-fold cross-validation, confusion matrix.

## Dataset
Synthetic, India-style dataset generated from credit-officer rules plus noise (see
`data/generate_dataset.py`). To use a real dataset (e.g. Kaggle "Loan Approval Prediction"),
put it in `data/loan_data.csv` using the same column names and retrain.

## Design choices worth explaining in viva
- **Engineered features:** EMI (standard formula), debt-to-income, loan-to-income.
- **Pipeline:** imputation → scaling / one-hot → classifier, so no data leakage.
- **Fairness:** gender, marital status and religion are excluded from the features.
- **Explainability:** each input is swapped with the typical applicant's value to measure how
  much it moved the probability (model-agnostic what-if analysis).
- **Disclaimer:** educational project, synthetic data, not for real lending.
