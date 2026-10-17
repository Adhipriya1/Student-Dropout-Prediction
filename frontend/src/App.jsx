import { useState, useEffect } from "react";
import StudentForm, { EMPTY_STUDENT } from "./components/StudentForm";
import PredictionResult from "./components/PredictionResult";
import TopFactors from "./components/TopFactors";
import ShapExplanation from "./components/ShapExplanation";
import AcademicPerformance from "./components/AcademicPerformance";
import ModelComparison from "./components/ModelComparison";
import ModelEvolution from "./components/ModelEvolution";
import TeacherFeedback from "./components/TeacherFeedback";
import FeedbackLog from "./components/FeedbackLog";
import InterventionPanel from "./components/InterventionPanel";
import { api } from "./api";

export default function App() {
  const [student, setStudent] = useState(EMPTY_STUDENT);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [samples, setSamples] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [activeSample, setActiveSample] = useState(null);

  useEffect(() => {
    api.sampleStudents().then(setSamples).catch(() => {});
  }, []);

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(student).map(([k, v]) => [k, Number(v)])
      );
      const res = await api.predict(payload);
      setResult(res);
      setAssessmentCount((count) => count + 1);
    } catch (e) {
      setError(e.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (s) => {
    const { label, ...rest } = s;
    setStudent(rest);
    setActiveSample(label);
    setResult(null);
    setError(null);
  };

  const resetAssessment = () => {
    setStudent(EMPTY_STUDENT);
    setActiveSample(null);
    setResult(null);
    setError(null);
  };

  const riskPercent = result ? Math.round(result.probability * 100) : null;
  const completedFields = Object.values(student).filter((value) => value !== "").length;

  return (
    <div className="min-h-screen app-shell">
      <header className="app-header">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark" aria-hidden="true">EW</div>
            <div>
              <p className="eyebrow">Student success operations</p>
              <h1 className="text-xl font-bold text-slate-950 tracking-tight">Early Warning Console</h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 status-chip">
            <span className="status-dot" /> Model online
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="hero-panel">
          <div>
            <p className="eyebrow hero-eyebrow">Assessment workspace</p>
            <h2>Turn signals into timely support.</h2>
            <p className="hero-copy">Build a student profile, review the risk story, and leave a human judgment trail for the next intervention.</p>
          </div>
          <div className="hero-meta">
            <span className="hero-meta-label">Current case</span>
            <strong>{activeSample || (result ? "Latest assessment" : "New assessment")}</strong>
            <span className="hero-meta-note">{completedFields} of 9 fields ready</span>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Assessment summary">
          <div className="metric-tile"><span className="metric-label">Assessments</span><strong>{assessmentCount}</strong><span className="metric-note">this session</span></div>
          <div className="metric-tile"><span className="metric-label">Current risk</span><strong className={result?.prediction === "Dropout" ? "text-red-600" : "text-emerald-600"}>{riskPercent === null ? "--" : `${riskPercent}%`}</strong><span className="metric-note">dropout probability</span></div>
          <div className="metric-tile"><span className="metric-label">Model focus</span><strong>Recall</strong><span className="metric-note">dropout cases weighted</span></div>
          <div className="metric-tile"><span className="metric-label">Review status</span><strong>{result ? "Ready" : "Waiting"}</strong><span className="metric-note">human decision layer</span></div>
        </section>

        {samples.length > 0 && (
          <div className="sample-toolbar">
            <div><p className="eyebrow">Fast start</p><p className="sample-title">Load a profile to explore</p></div>
            <div className="flex flex-wrap gap-2 items-center">
            {samples.map((s) => (
              <button
                key={s.label}
                onClick={() => loadSample(s)}
                className={`sample-button ${activeSample === s.label ? "sample-button-active" : ""}`}
              >
                {s.label}
              </button>
            ))}
            </div>
            <button type="button" onClick={resetAssessment} className="reset-button">Reset case</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <StudentForm
            value={student}
            onChange={setStudent}
            onSubmit={handlePredict}
            loading={loading}
            error={error}
          />

          <div className="space-y-6">
            {result ? (
              <>
                <PredictionResult result={result} />
                <AcademicPerformance student={student} />
              </>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">01</span>
                <h3>Your risk story will appear here</h3>
                <p>Complete the profile on the left, then run an assessment to see the probability, drivers, and next actions.</p>
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <TopFactors factors={result.top_factors} />
            <ShapExplanation shap={result.shap_explanation} />
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <InterventionPanel result={result} />
            <TeacherFeedback
              result={result}
              studentInput={student}
              onModelUpdated={() => setRefreshKey((n) => n + 1)}
            />
          </div>
        )}

        {result && <FeedbackLog refreshKey={refreshKey} />}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <ModelComparison refreshKey={refreshKey} />
          <ModelEvolution refreshKey={refreshKey} />
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        Predictions are decision support only and do not replace professional judgment.
      </footer>
    </div>
  );
}
