import { useState } from "react";
import { api } from "../api";

export default function InterventionPanel({ result }) {
  const [agree, setAgree] = useState(null);
  const [modified, setModified] = useState("");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!result?.interventions) return null;

  const handleSubmit = async () => {
    if (agree === null) return;
    setStatus("saving");
    try {
      await api.submitInterventionFeedback({
        prediction_id: result.prediction_id,
        interventions: result.interventions,
        agree,
        modified_intervention: agree ? null : modified.trim() || null,
      });
      setStatus("saved");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Recommended Interventions</h2>
      <p className="text-sm text-slate-500 mb-4">
        Rule-based suggestions generated from this student's academic and financial profile.
      </p>

      <ul className="space-y-2 mb-4">
        {result.interventions.map((rec, i) => (
          <li
            key={i}
            className="flex gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
          >
            <span className="text-indigo-500 font-medium">{i + 1}.</span>
            <span>{rec}</span>
          </li>
        ))}
      </ul>

      {status === "saved" ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">
          Faculty review recorded. Thank you.
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500 mb-2">Do you approve these interventions?</p>
          <div className="flex gap-3 mb-3">
            <button
              type="button"
              onClick={() => setAgree(true)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                agree === true
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setAgree(false)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                agree === false
                  ? "bg-amber-600 text-white border-amber-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Suggest Different
            </button>
          </div>

          {agree === false && (
            <textarea
              value={modified}
              onChange={(e) => setModified(e.target.value)}
              placeholder="Enter your modified intervention recommendation"
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
            />
          )}

          {status === "error" && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 mb-3">
              {errorMsg}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={agree === null || status === "saving"}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 transition-colors"
          >
            {status === "saving" ? "Saving..." : "Submit Review"}
          </button>
        </>
      )}
    </div>
  );
}
