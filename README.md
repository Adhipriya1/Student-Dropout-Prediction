# Student Dropout Prediction & Early Warning System

A full-stack web app that predicts student dropout risk using the exact ML
pipeline from `MLproj.ipynb`: a class-weighted Logistic Regression model
(with Random Forest shown for comparison), SHAP explanations, and a
teacher feedback loop.

## Project Structure

```
project/
├── backend/
│   ├── main.py                  # FastAPI app (all API endpoints)
│   ├── train_model.py           # Reproduces the notebook's training pipeline
│   ├── data.csv                 # UCI "Predict Students' Dropout" dataset (local copy)
│   ├── requirements.txt
│   ├── sample_test_data.json    # Sample students for quick testing
│   ├── model.pkl                # Base trained Logistic Regression (generated)
│   ├── rf_model.pkl             # Trained Random Forest (generated)
│   ├── scaler.pkl               # Fitted StandardScaler for the base model (generated)
│   ├── updated_model.pkl        # "Active" HITL-updated Logistic Regression (generated)
│   ├── updated_scaler.pkl       # Scaler for the active model (generated)
│   ├── metrics.json             # Base LR vs RF vs updated-LR evaluation metrics (generated)
│   ├── feature_importance.json  # Base LR coefficients (generated)
│   ├── coefficient_comparison.json  # Coefficients before/after HITL feedback (generated)
│   ├── shap_background.csv      # SHAP background sample (generated)
│   ├── X_train_raw.csv / y_train_raw.csv / X_test_raw.csv / y_test_raw.csv
│   │                             # Raw (unscaled) split, persisted for runtime retraining (generated)
│   ├── feedback_training_data.csv   # Accumulated teacher corrections used to retrain (generated)
│   ├── feedback.json            # Stored teacher feedback (generated at runtime)
│   └── interventions.json       # Stored faculty intervention reviews (generated at runtime)
└── frontend/
    ├── src/
    │   ├── App.jsx               # Page layout / state
    │   ├── api.js                # Backend API client
    │   └── components/
    │       ├── StudentForm.jsx
    │       ├── PredictionResult.jsx
    │       ├── TopFactors.jsx
    │       ├── ShapExplanation.jsx
    │       ├── AcademicPerformance.jsx
    │       ├── ModelComparison.jsx      # Base LR vs Random Forest vs updated LR
    │       ├── ModelEvolution.jsx       # Coefficients before/after HITL feedback
    │       ├── InterventionPanel.jsx    # Rule-based recommendations + faculty review
    │       ├── TeacherFeedback.jsx      # Agree/disagree -> triggers retraining
    │       └── FeedbackLog.jsx
    ├── vite.config.js            # Dev proxy: /api -> http://localhost:8000
    └── package.json
```

## ML Implementation (matches the notebooks exactly)

Base pipeline — identical in `MLproj.ipynb` and the first 20 cells of `ML_new.ipynb`:

- **Dataset**: UCI "Predict Students' Dropout and Academic Success" (id 697)
- **Target**: binarized — `Dropout = 1`, `Graduate`/`Enrolled` = 0
- **Features (9)**: Age at enrollment, Admission grade, Tuition fees up to
  date, Scholarship holder, 1st/2nd sem units approved, 1st/2nd sem units
  grade, 2nd sem units enrolled
- **Split**: 80/20, `random_state=42`
- **Scaling**: `StandardScaler`
- **Model**: `LogisticRegression(max_iter=1000, class_weight={0:1, 1:2})`
- **Comparison model**: `RandomForestClassifier(n_estimators=100, random_state=42)`
- **Explainability**: LR coefficients (global "Top Risk Factors") + `shap.Explainer`
  per-student local explanation
- **Persistence**: `joblib.dump` for model/scaler, same as the notebook's
  final cell

Human-in-the-loop additions — from `ML_new.ipynb`'s later cells:

- **Closed-loop retraining**: when a teacher submits feedback, the app treats
  agree as confirming the model's label and disagree as flipping it, appends
  that row to the training set with `sample_weight=5` (same weighting as the
  notebook), refits `StandardScaler` + `LogisticRegression` on the combined
  data, and persists the result as the "active" model (`updated_model.pkl` /
  `updated_scaler.pkl`). Corrections accumulate across restarts via
  `feedback_training_data.csv`.
- **Coefficient before/after tracking**: every retrain recomputes and stores
  a feature-by-feature comparison (`coefficient_comparison.json`), shown in
  the "Model Evolution" chart.
- **Rule-based intervention recommender**: reproduces `generate_intervention()`
  from the notebook — flags low approved units, low grades, overdue tuition,
  and missing scholarship status into concrete action items, returned with
  every prediction and reviewable by faculty (approve or suggest a different
  recommendation).

`train_model.py` first tries to download the dataset from the official UCI
URL (as the notebook does). If that's unreachable (e.g. no internet, some
sandboxed environments), it falls back to the bundled `backend/data.csv`,
which is the same dataset.

## Setup

### 1. Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Train the model once (creates model.pkl, scaler.pkl, rf_model.pkl, metrics.json, etc.)
python train_model.py

# Run the API
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` (interactive docs at
`http://localhost:8000/docs`).

### 2. Frontend (React + Vite + Tailwind)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` requests
to `http://localhost:8000`, so the frontend talks to FastAPI automatically —
no extra config needed.

For production build:

```bash
npm run build   # outputs to frontend/dist
npm run preview
```

## API Endpoints

| Method | Endpoint               | Description                                              |
|--------|-------------------------|------------------------------------------------------------|
| POST   | `/api/predict`          | Predict dropout for a student; returns probability, risk level, SHAP explanation, top factors, human-readable explanation, and rule-based interventions |
| GET    | `/api/model-comparison` | Base Logistic Regression vs Random Forest vs HITL-updated LR metrics (accuracy, precision, recall, F1, confusion matrix) |
| GET    | `/api/coefficient-comparison` | Per-feature LR coefficients before vs after HITL feedback |
| POST   | `/api/feedback`         | Store teacher feedback (agree/disagree + optional reason) and retrain the active model in place with the corrected label |
| GET    | `/api/feedback`         | Retrieve stored feedback history                          |
| POST   | `/api/intervention-feedback` | Store faculty review (approve / suggest different) of the recommended interventions |
| GET    | `/api/intervention-feedback` | Retrieve stored intervention review history         |
| GET    | `/api/sample-students`  | Sample student records for quick testing                  |

### Example: `POST /api/predict`

Request:
```json
{
  "age_at_enrollment": 22,
  "admission_grade": 110,
  "tuition_fees_up_to_date": 0,
  "scholarship_holder": 0,
  "units_1st_sem_approved": 2,
  "units_1st_sem_grade": 8.5,
  "units_2nd_sem_approved": 1,
  "units_2nd_sem_grade": 7.0,
  "units_2nd_sem_enrolled": 6
}
```

Response (abbreviated):
```json
{
  "prediction": "Dropout",
  "probability": 0.9892,
  "risk_level": "High",
  "top_factors": [ { "feature": "2nd Sem Units Approved", "coefficient": -1.7788 }, "..." ],
  "shap_explanation": [ { "feature": "Tuition Fees Up to Date", "shap_value": 2.0126, "effect": "increases" }, "..." ],
  "explanation": "This student is predicted to be at risk of dropping out. ...",
  "interventions": [
    "Academic counseling: Review 2nd semester academic performance.",
    "Financial support: Discuss tuition payment issues and available financial assistance."
  ]
}
```

### Example: `POST /api/feedback` (triggers retraining)

Request:
```json
{
  "prediction_id": "a62a9358-...",
  "prediction": "Dropout",
  "probability": 0.9892,
  "agree": false,
  "reason": "Strong family support system, not reflected in data.",
  "student_input": { "age_at_enrollment": 22, "...": "..." }
}
```

Response:
```json
{
  "status": "stored",
  "total_feedback": 1,
  "model_retrained": true,
  "updated_metrics": { "accuracy": 0.8497, "recall": 0.788, "...": "..." },
  "coefficient_comparison": [ { "feature": "Age at Enrollment", "before": 0.3145, "after": 0.3158, "change": 0.0013 }, "..." ]
}
```

## Sample Test Data

See `backend/sample_test_data.json` (also served live at
`GET /api/sample-students` and available as one-click buttons in the UI):
a High Risk, Medium Risk, and Low Risk example student.

## Validation & Error Handling

- All 9 inputs are constrained server-side via Pydantic (`Field(ge=..., le=...)`)
  matching realistic ranges (e.g. admission grade 0-200, semester grade 0-20).
- Invalid input returns `400` with a descriptive error message.
- The frontend form validates ranges client-side before submitting and
  surfaces backend errors inline.
- Missing model artifacts (if `train_model.py` hasn't been run) raise a
  clear startup error rather than failing silently.

## Notes

- This app implements the 10 core features (student input form, dropout
  prediction, risk score, top risk factors, SHAP explanation, academic
  performance summary, model comparison, prediction explanation, teacher
  feedback, feedback storage), plus the human-in-the-loop retraining and
  intervention recommender added in `ML_new.ipynb`. No login, payments,
  chat, notifications, or attendance tracking were added.
- Feedback and intervention reviews are stored in flat JSON files
  (`backend/feedback.json`, `backend/interventions.json`) — sufficient for
  "store so it can be reviewed later" without adding a database dependency.
- Retraining is synchronous and runs on the small (~3,500-row) dataset, so
  it completes in well under a second per feedback submission — no background
  job queue needed.
