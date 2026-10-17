"""
Trains and saves the models used by the API, using the SAME logic as MLproj.ipynb:
- Binary target: Dropout=1, Graduate/Enrolled=0
- 9 selected features
- 80/20 train/test split, random_state=42
- StandardScaler
- LogisticRegression(max_iter=1000, class_weight={0:1,1:2})
- RandomForestClassifier(n_estimators=100, random_state=42)  (comparison model)
- Saves model.pkl / scaler.pkl / rf_model.pkl via joblib, plus metrics + a SHAP
  background sample used by the API for per-student explanations.

Run once: `python train_model.py`
"""
import json
import os

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_URL = "https://archive.ics.uci.edu/static/public/697/data.csv"
LOCAL_FALLBACK = os.path.join(BASE, "data.csv")

SELECTED_FEATURES = [
    "Age at enrollment",
    "Admission grade",
    "Tuition fees up to date",
    "Scholarship holder",
    "Curricular units 1st sem (approved)",
    "Curricular units 1st sem (grade)",
    "Curricular units 2nd sem (approved)",
    "Curricular units 2nd sem (grade)",
    "Curricular units 2nd sem (enrolled)",
]


def load_data() -> pd.DataFrame:
    """Same source as the notebook (UCI dataset 697); falls back to a local
    copy of the same dataset if the UCI endpoint isn't reachable (e.g. offline
    dev / sandboxed environments)."""
    try:
        df = pd.read_csv(DATA_URL)
        if df.shape[1] < 30:
            raise ValueError("unexpected column count from UCI endpoint")
        print("Loaded dataset from UCI repository.")
    except Exception as e:  # noqa: BLE001
        print(f"UCI fetch failed ({e}); using local fallback data.csv")
        df = pd.read_csv(LOCAL_FALLBACK)
    df.columns = [c.replace("\ufeff", "") for c in df.columns]
    return df


def main():
    df = load_data()

    # Binary target (same mapping as notebook)
    df["Target"] = df["Target"].map({"Dropout": 1, "Graduate": 0, "Enrolled": 0})

    X = df[SELECTED_FEATURES]
    y = df["Target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # --- Logistic Regression (class-weighted, as chosen in the notebook) ---
    lr_model = LogisticRegression(max_iter=1000, class_weight={0: 1, 1: 2})
    lr_model.fit(X_train_scaled, y_train)
    lr_pred = lr_model.predict(X_test_scaled)

    # --- Random Forest (comparison model) ---
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_model.fit(X_train_scaled, y_train)
    rf_pred = rf_model.predict(X_test_scaled)

    def summarize(y_true, y_pred):
        return {
            "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
            "precision": round(float(precision_score(y_true, y_pred)), 4),
            "recall": round(float(recall_score(y_true, y_pred)), 4),
            "f1_score": round(float(f1_score(y_true, y_pred)), 4),
            "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        }

    metrics = {
        "logistic_regression": summarize(y_test, lr_pred),
        "random_forest": summarize(y_test, rf_pred),
    }
    with open(os.path.join(BASE, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # Feature importance from LR coefficients (used for "Top Risk Factors")
    coef_importance = dict(zip(SELECTED_FEATURES, lr_model.coef_[0].tolist()))
    with open(os.path.join(BASE, "feature_importance.json"), "w") as f:
        json.dump(coef_importance, f, indent=2)

    # SHAP background sample (scaled, with column names) for per-student explanations
    X_train_df = pd.DataFrame(X_train_scaled, columns=SELECTED_FEATURES)
    background = X_train_df.sample(n=min(100, len(X_train_df)), random_state=42)
    background.to_csv(os.path.join(BASE, "shap_background.csv"), index=False)

    joblib.dump(lr_model, os.path.join(BASE, "model.pkl"))
    joblib.dump(rf_model, os.path.join(BASE, "rf_model.pkl"))
    joblib.dump(scaler, os.path.join(BASE, "scaler.pkl"))

    # The "updated" (HITL) model starts as a copy of the base model. It gets
    # re-trained in place by the API whenever a teacher's corrected feedback
    # comes in (see main.py: retrain_with_feedback).
    joblib.dump(lr_model, os.path.join(BASE, "updated_model.pkl"))
    joblib.dump(scaler, os.path.join(BASE, "updated_scaler.pkl"))
    metrics["updated_logistic_regression"] = metrics["logistic_regression"]
    with open(os.path.join(BASE, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # Raw (unscaled) train/test splits, persisted so the API can retrain the
    # "updated" model at runtime without re-fetching/re-splitting the dataset.
    X_train.to_csv(os.path.join(BASE, "X_train_raw.csv"), index=False)
    y_train.to_csv(os.path.join(BASE, "y_train_raw.csv"), index=False)
    X_test.to_csv(os.path.join(BASE, "X_test_raw.csv"), index=False)
    y_test.to_csv(os.path.join(BASE, "y_test_raw.csv"), index=False)

    # Coefficient comparison starts identical (no feedback applied yet)
    coef_comparison = [
        {"feature": f, "before": round(c, 4), "after": round(c, 4), "change": 0.0}
        for f, c in coef_importance.items()
    ]
    with open(os.path.join(BASE, "coefficient_comparison.json"), "w") as f:
        json.dump(coef_comparison, f, indent=2)

    # Accumulated teacher corrections used to retrain the "updated" model.
    # Each row: the 9 raw features + Target (corrected label) + sample_weight.
    feedback_csv = os.path.join(BASE, "feedback_training_data.csv")
    if not os.path.exists(feedback_csv):
        pd.DataFrame(columns=SELECTED_FEATURES + ["Target", "sample_weight"]).to_csv(
            feedback_csv, index=False
        )

    print("\nTraining complete. Artifacts saved to backend/.")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
