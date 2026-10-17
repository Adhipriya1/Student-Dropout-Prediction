import { useState } from "react";

export const FIELDS = [
  { key: "age_at_enrollment", label: "Age at Enrollment", type: "number", min: 15, max: 70, step: 1 },
  { key: "admission_grade", label: "Admission Grade (0-200)", type: "number", min: 0, max: 200, step: 0.1 },
  { key: "tuition_fees_up_to_date", label: "Tuition Fees Up to Date", type: "bool" },
  { key: "scholarship_holder", label: "Scholarship Holder", type: "bool" },
  { key: "units_1st_sem_approved", label: "1st Sem Units Approved", type: "number", min: 0, max: 30, step: 1 },
  { key: "units_1st_sem_grade", label: "1st Sem Units Grade (0-20)", type: "number", min: 0, max: 20, step: 0.1 },
  { key: "units_2nd_sem_approved", label: "2nd Sem Units Approved", type: "number", min: 0, max: 30, step: 1 },
  { key: "units_2nd_sem_grade", label: "2nd Sem Units Grade (0-20)", type: "number", min: 0, max: 20, step: 0.1 },
  { key: "units_2nd_sem_enrolled", label: "2nd Sem Units Enrolled", type: "number", min: 0, max: 30, step: 1 },
];

export const EMPTY_STUDENT = FIELDS.reduce((acc, f) => {
  acc[f.key] = f.type === "bool" ? 1 : "";
  return acc;
}, {});

export default function StudentForm({ value, onChange, onSubmit, loading, error }) {
  const [touched, setTouched] = useState(false);

  const set = (key, v) => onChange({ ...value, [key]: v });

  const isValid = FIELDS.every((f) => {
    const v = value[f.key];
    if (v === "" || v === null || v === undefined) return false;
    if (f.type === "number") return !isNaN(v) && v >= f.min && v <= f.max;
    return true;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (isValid) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Student Input</h2>
      <p className="text-sm text-slate-500 mb-5">
        Enter enrollment, financial, and semester performance data.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => {
          const v = value[f.key];
          const invalid =
            touched &&
            (v === "" || v === null || (f.type === "number" && (isNaN(v) || v < f.min || v > f.max)));
          return (
            <div key={f.key} className={f.type === "bool" ? "" : ""}>
              <label className="block text-sm font-medium text-slate-600 mb-1">{f.label}</label>
              {f.type === "bool" ? (
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={v}
                  onChange={(e) => set(f.key, Number(e.target.value))}
                >
                  <option value={1}>Yes</option>
                  <option value={0}>No</option>
                </select>
              ) : (
                <input
                  type="number"
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  value={v}
                  onChange={(e) => set(f.key, e.target.value === "" ? "" : Number(e.target.value))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                    invalid ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-indigo-500"
                  }`}
                  placeholder={`${f.min} - ${f.max}`}
                />
              )}
              {invalid && (
                <p className="text-xs text-red-500 mt-1">
                  Enter a value between {f.min} and {f.max}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 text-sm transition-colors"
      >
        {loading ? "Predicting..." : "Predict Dropout Risk"}
      </button>
    </form>
  );
}
