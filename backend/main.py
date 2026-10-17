"""
Student Dropout Prediction & Early Warning API.

Reuses the exact model/scaler trained in train_model.py (base logic from
MLproj.ipynb), plus the human-in-the-loop retraining and intervention
recommender introduced in ML_new.ipynb:
  - Teacher feedback with a corrected label retrains an "updated" model
    in place (sample_weight-boosted, same as the notebook's HITL cells).
  - A rule-based intervention recommender runs on every prediction and
    can be reviewed/approved by faculty, same as the notebook's cells.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import joblib
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from sklearn.preprocessing import StandardScaler

BASE = os.path.dirname(os.path.abspath(__file__))

FEATURES = [
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

FEATURE_LABELS = {
    "Age at enrollment": "Age at Enrollment",
    "Admission grade": "Admission Grade",
    "Tuition fees up to date": "Tuition Fees Up to Date",
    "Scholarship holder": "Scholarship Holder",
    "Curricular units 1st sem (approved)": "1st Sem Units Approved",
    "Curricular units 1st sem (grade)": "1st Sem Units Grade",
    "Curricular units 2nd sem (approved)": "2nd Sem Units Approved",
    "Curricular units 2nd sem (grade)": "2nd Sem Units Grade",
    "Curricular units 2nd sem (enrolled)": "2nd Sem Units Enrolled",
}

# ---------------------------------------------------------------------------
# Load trained artifacts (produced by train_model.py)
# ---------------------------------------------------------------------------
REQUIRED_ARTIFACTS = [
    "model.pkl", "scaler.pkl", "rf_model.pkl", "updated_model.pkl", "updated_scaler.pkl",
    "metrics.json", "feature_importance.json", "shap_background.csv",
    "X_train_raw.csv", "y_train_raw.csv", "X_test_raw.csv", "y_test_raw.csv",
    "coefficient_comparison.json", "feedback_training_data.csv",
]
missing = [a for a in REQUIRED_ARTIFACTS if not os.path.exists(os.path.join(BASE, a))]
if missing:
    raise RuntimeError(
        f"Missing model artifacts {missing}. Run `python train_model.py` first."
    )

model = joblib.load(os.path.join(BASE, "model.pkl"))  # base model (immutable reference)
rf_model = joblib.load(os.path.join(BASE, "rf_model.pkl"))
scaler = joblib.load(os.path.join(BASE, "scaler.pkl"))

# "Active" model used for predictions: starts equal to the base model and is
# replaced in place whenever a teacher's corrected feedback retrains it.
active_model = joblib.load(os.path.join(BASE, "updated_model.pkl"))
active_scaler = joblib.load(os.path.join(BASE, "updated_scaler.pkl"))

with open(os.path.join(BASE, "metrics.json")) as f:
    METRICS = json.load(f)
with open(os.path.join(BASE, "feature_importance.json")) as f:
    FEATURE_IMPORTANCE = json.load(f)
with open(os.path.join(BASE, "coefficient_comparison.json")) as f:
    COEF_COMPARISON = json.load(f)

X_train_raw = pd.read_csv(os.path.join(BASE, "X_train_raw.csv"))
y_train_raw = pd.read_csv(os.path.join(BASE, "y_train_raw.csv")).iloc[:, 0]
X_test_raw = pd.read_csv(os.path.join(BASE, "X_test_raw.csv"))
y_test_raw = pd.read_csv(os.path.join(BASE, "y_test_raw.csv")).iloc[:, 0]

background = pd.read_csv(os.path.join(BASE, "shap_background.csv"))
explainer = shap.Explainer(model, background)  # SHAP explains the base model, kept stable

FEEDBACK_FILE = os.path.join(BASE, "feedback.json")
if not os.path.exists(FEEDBACK_FILE):
    with open(FEEDBACK_FILE, "w") as f:
        json.dump([], f)

INTERVENTIONS_FILE = os.path.join(BASE, "interventions.json")
if not os.path.exists(INTERVENTIONS_FILE):
    with open(INTERVENTIONS_FILE, "w") as f:
        json.dump([], f)

FEEDBACK_TRAINING_FILE = os.path.join(BASE, "feedback_training_data.csv")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Student Dropout Prediction & Early Warning API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StudentInput(BaseModel):
    age_at_enrollment: float = Field(..., ge=15, le=70, description="Age at enrollment")
    admission_grade: float = Field(..., ge=0, le=200, description="Admission grade (0-200)")
    tuition_fees_up_to_date: int = Field(..., ge=0, le=1, description="1 = yes, 0 = no")
    scholarship_holder: int = Field(..., ge=0, le=1, description="1 = yes, 0 = no")
    units_1st_sem_approved: float = Field(..., ge=0, le=30)
    units_1st_sem_grade: float = Field(..., ge=0, le=20)
    units_2nd_sem_approved: float = Field(..., ge=0, le=30)
    units_2nd_sem_grade: float = Field(..., ge=0, le=20)
    units_2nd_sem_enrolled: float = Field(..., ge=0, le=30)


class FeedbackInput(BaseModel):
    prediction_id: str
    prediction: str
    probability: float
    agree: bool
    reason: Optional[str] = None
    student_input: dict  # required: needed to retrain the updated model


class InterventionFeedbackInput(BaseModel):
    prediction_id: str
    interventions: list[str]
    agree: bool
    modified_intervention: Optional[str] = None


def to_row(s: StudentInput) -> pd.DataFrame:
    return pd.DataFrame(
        [[
            s.age_at_enrollment,
            s.admission_grade,
            s.tuition_fees_up_to_date,
            s.scholarship_holder,
            s.units_1st_sem_approved,
            s.units_1st_sem_grade,
            s.units_2nd_sem_approved,
            s.units_2nd_sem_grade,
            s.units_2nd_sem_enrolled,
        ]],
        columns=FEATURES,
    )


def risk_level(prob: float) -> str:
    if prob < 0.35:
        return "Low"
    if prob < 0.65:
        return "Medium"
    return "High"


def build_explanation(s: StudentInput, pred: int, shap_contribs: list) -> str:
    increasing = [c["feature"] for c in shap_contribs if c["effect"] == "increases"][:3]
    decreasing = [c["feature"] for c in shap_contribs if c["effect"] == "decreases"][:3]
    parts = []
    if pred == 1:
        parts.append("This student is predicted to be at risk of dropping out.")
        if s.units_1st_sem_approved <= 3 or s.units_2nd_sem_approved <= 3:
            parts.append(
                "A low number of approved curricular units is the primary academic "
                "warning sign, consistent with the strongest drivers of dropout risk "
                "in the model."
            )
        if increasing:
            parts.append(f"Factors increasing risk: {', '.join(increasing)}.")
        if decreasing:
            parts.append(f"Factors partially offsetting risk: {', '.join(decreasing)}.")
    else:
        parts.append("This student is predicted to continue (Not Dropout).")
        if decreasing:
            parts.append(f"Strong supporting factors: {', '.join(decreasing)}.")
        if increasing:
            parts.append(f"Minor risk factors to monitor: {', '.join(increasing)}.")
    return " ".join(parts)


def generate_interventions(s: StudentInput) -> list:
    """Rule-based intervention recommender, same thresholds as ML_new.ipynb's
    generate_intervention()."""
    recs = []
    if s.units_2nd_sem_approved < 5:
        recs.append("Academic counseling: Review 2nd semester academic performance.")
    if s.units_1st_sem_approved < 5:
        recs.append("Academic support: Provide additional academic guidance for 1st semester subjects.")
    if s.units_2nd_sem_grade < 10:
        recs.append("Faculty mentoring: Monitor grades and provide subject-level support.")
    if s.tuition_fees_up_to_date == 0:
        recs.append("Financial support: Discuss tuition payment issues and available financial assistance.")
    if s.scholarship_holder == 0:
        recs.append("Scholarship support: Check whether the student is eligible for financial assistance.")
    if not recs:
        recs.append("Continue regular academic monitoring and faculty mentoring.")
    return recs


def retrain_with_feedback(student: StudentInput, corrected_label: int):
    """Human-in-the-loop retraining, same approach as ML_new.ipynb: append the
    teacher-corrected sample to the training set with sample_weight=5, refit
    scaler + Logistic Regression, and persist as the new 'active' model."""
    global active_model, active_scaler, METRICS, COEF_COMPARISON

    new_row = to_row(student)
    new_row["Target"] = corrected_label

    # Persist this correction so it accumulates across restarts
    stored = pd.read_csv(FEEDBACK_TRAINING_FILE)
    stored = pd.concat([stored, new_row.assign(sample_weight=5)], ignore_index=True)
    stored.to_csv(FEEDBACK_TRAINING_FILE, index=False)

    # Rebuild training set: original raw training rows (weight 1) + all
    # accumulated corrections (weight 5 each)
    X_combined = pd.concat(
        [X_train_raw, stored[FEATURES]], ignore_index=True
    )
    y_combined = pd.concat(
        [y_train_raw.reset_index(drop=True), stored["Target"].astype(int)], ignore_index=True
    )
    weights = [1] * len(X_train_raw) + stored["sample_weight"].astype(int).tolist()

    updated_scaler = StandardScaler()
    X_combined_scaled = pd.DataFrame(
        updated_scaler.fit_transform(X_combined), columns=FEATURES
    )

    updated_model = LogisticRegression(max_iter=1000, class_weight={0: 1, 1: 2})
    updated_model.fit(X_combined_scaled, y_combined, sample_weight=weights)

    # Evaluate on the fixed held-out test set
    X_test_scaled = pd.DataFrame(updated_scaler.transform(X_test_raw), columns=FEATURES)
    pred = updated_model.predict(X_test_scaled)
    updated_metrics = {
        "accuracy": round(float(accuracy_score(y_test_raw, pred)), 4),
        "precision": round(float(precision_score(y_test_raw, pred)), 4),
        "recall": round(float(recall_score(y_test_raw, pred)), 4),
        "f1_score": round(float(f1_score(y_test_raw, pred)), 4),
        "confusion_matrix": confusion_matrix(y_test_raw, pred).tolist(),
    }

    coef_comparison = [
        {
            "feature": FEATURE_LABELS[f],
            "before": round(float(c), 4),
            "after": round(float(updated_model.coef_[0][i]), 4),
            "change": round(float(updated_model.coef_[0][i] - c), 4),
        }
        for i, (f, c) in enumerate(FEATURE_IMPORTANCE.items())
    ]

    # Persist everything
    joblib.dump(updated_model, os.path.join(BASE, "updated_model.pkl"))
    joblib.dump(updated_scaler, os.path.join(BASE, "updated_scaler.pkl"))
    METRICS["updated_logistic_regression"] = updated_metrics
    with open(os.path.join(BASE, "metrics.json"), "w") as f:
        json.dump(METRICS, f, indent=2)
    with open(os.path.join(BASE, "coefficient_comparison.json"), "w") as f:
        json.dump(coef_comparison, f, indent=2)

    active_model = updated_model
    active_scaler = updated_scaler
    COEF_COMPARISON = coef_comparison

    return updated_metrics, coef_comparison


@app.get("/")
def root():
    return {"status": "ok", "service": "Student Dropout Prediction API"}


@app.post("/api/predict")
def predict(student: StudentInput):
    try:
        row = to_row(student)

        # Predictions use the "active" model (base model, or the HITL-updated
        # model if any teacher corrections have been applied so far)
        active_scaled = active_scaler.transform(row)
        active_scaled_df = pd.DataFrame(active_scaled, columns=FEATURES)
        pred = int(active_model.predict(active_scaled_df)[0])
        prob = float(active_model.predict_proba(active_scaled_df)[0][1])
        label = "Dropout" if pred == 1 else "Not Dropout"

        # SHAP explains the stable base model/scaler (SHAP background was
        # fit against it); this keeps explanations consistent even as the
        # active model evolves with feedback.
        scaled = scaler.transform(row)
        scaled_df = pd.DataFrame(scaled, columns=FEATURES)
        shap_vals = explainer(scaled_df)
        shap_row = shap_vals[0]
        shap_contribs = []
        for i, feat in enumerate(FEATURES):
            sv = float(shap_row.values[i])
            shap_contribs.append({
                "feature": FEATURE_LABELS[feat],
                "input_value": row.iloc[0][feat],
                "shap_value": round(sv, 4),
                "effect": "increases" if sv > 0 else "decreases",
            })
        shap_contribs.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        # Global top risk factors from LR coefficients
        top_factors = sorted(
            [
                {"feature": FEATURE_LABELS[f], "coefficient": round(c, 4)}
                for f, c in FEATURE_IMPORTANCE.items()
            ],
            key=lambda x: abs(x["coefficient"]),
            reverse=True,
        )

        return {
            "prediction_id": str(uuid.uuid4()),
            "prediction": label,
            "probability": round(prob, 4),
            "risk_level": risk_level(prob),
            "top_factors": top_factors,
            "shap_explanation": shap_contribs,
            "explanation": build_explanation(student, pred, shap_contribs),
            "interventions": generate_interventions(student),
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/model-comparison")
def model_comparison():
    return METRICS


@app.get("/api/coefficient-comparison")
def coefficient_comparison():
    return COEF_COMPARISON


@app.post("/api/feedback")
def submit_feedback(fb: FeedbackInput):
    """Stores teacher feedback and, same as ML_new.ipynb's HITL cells,
    retrains the active model in place using the teacher-corrected label
    (agree -> keep the model's prediction; disagree -> flip it), weighted
    5x against the original training rows."""
    try:
        student = StudentInput(**fb.student_input)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Invalid student_input: {e}")

    original_pred = 1 if fb.prediction == "Dropout" else 0
    corrected_label = original_pred if fb.agree else (1 - original_pred)

    updated_metrics, coef_comparison = retrain_with_feedback(student, corrected_label)

    with open(FEEDBACK_FILE) as f:
        data = json.load(f)
    entry = fb.model_dump()
    entry["corrected_label"] = "Dropout" if corrected_label == 1 else "Not Dropout"
    entry["timestamp"] = datetime.now(timezone.utc).isoformat()
    data.append(entry)
    with open(FEEDBACK_FILE, "w") as f:
        json.dump(data, f, indent=2)

    return {
        "status": "stored",
        "total_feedback": len(data),
        "model_retrained": True,
        "updated_metrics": updated_metrics,
        "coefficient_comparison": coef_comparison,
    }


@app.get("/api/feedback")
def get_feedback():
    with open(FEEDBACK_FILE) as f:
        return json.load(f)


@app.post("/api/intervention-feedback")
def submit_intervention_feedback(fb: InterventionFeedbackInput):
    with open(INTERVENTIONS_FILE) as f:
        data = json.load(f)
    entry = fb.model_dump()
    entry["timestamp"] = datetime.now(timezone.utc).isoformat()
    data.append(entry)
    with open(INTERVENTIONS_FILE, "w") as f:
        json.dump(data, f, indent=2)
    return {"status": "stored", "total_interventions": len(data)}


@app.get("/api/intervention-feedback")
def get_intervention_feedback():
    with open(INTERVENTIONS_FILE) as f:
        return json.load(f)


@app.get("/api/sample-students")
def sample_students():
    return [
        {
            "label": "High Risk Example",
            "age_at_enrollment": 22,
            "admission_grade": 110,
            "tuition_fees_up_to_date": 0,
            "scholarship_holder": 0,
            "units_1st_sem_approved": 2,
            "units_1st_sem_grade": 8.5,
            "units_2nd_sem_approved": 1,
            "units_2nd_sem_grade": 7.0,
            "units_2nd_sem_enrolled": 6,
        },
        {
            "label": "Medium Risk Example",
            "age_at_enrollment": 24,
            "admission_grade": 125,
            "tuition_fees_up_to_date": 1,
            "scholarship_holder": 0,
            "units_1st_sem_approved": 4,
            "units_1st_sem_grade": 11.0,
            "units_2nd_sem_approved": 3,
            "units_2nd_sem_grade": 10.5,
            "units_2nd_sem_enrolled": 6,
        },
        {
            "label": "Low Risk Example",
            "age_at_enrollment": 19,
            "admission_grade": 150,
            "tuition_fees_up_to_date": 1,
            "scholarship_holder": 1,
            "units_1st_sem_approved": 6,
            "units_1st_sem_grade": 14.5,
            "units_2nd_sem_approved": 6,
            "units_2nd_sem_grade": 15.0,
            "units_2nd_sem_enrolled": 6,
        },
    ]
