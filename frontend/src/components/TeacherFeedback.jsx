import { useState } from "react";
import { api } from "../api";

export default function TeacherFeedback({ result, studentInput, onModelUpdated }) {
  const [agree, setAgree] = useState(null);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [errorMsg, setErrorMsg] = useState("");
  const [retrainInfo, setRetrainInfo] = useState(null);

  if (!result) return null;

  const handleSubmit = async () => {
    if (agree === null) return;
    setStatus("saving");
    try {
      const res = await api.submitFeedback({
        prediction_id: result.prediction_id,
        prediction: result.prediction,
        probability: result.probability,
        agree,
        reason: reason.trim() || null,
        student_input: studentInput,
      });
      setRetrainInfo(res.updated_metrics);
      setStatus("saved");
      onModelUpdated?.();
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-1">Teacher Feedback</h2>
      <p className="text-sm text-slate-500 mb-4">
        Do you agree with this prediction? Your feedback retrains the model in place
        (a human-in-the-loop correction) and is stored for later review.
      </p>

      {status === "saved" ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">
          <p className="font-medium mb-1">Feedback recorded and model updated.</p>
          {retrainInfo && (
            <p className="text-xs text-emerald-600">
              Updated model — accuracy {Math.round(retrainInfo.accuracy * 100)}%, recall{" "}
              {Math.round(retrainInfo.recall * 100)}% on the held-out test set.
            </p>
          )}
        </div>
      ) : (
        <>
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
              Agree
            </button>
            <button
              type="button"
              onClick={() => setAgree(false)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                agree === false
                  ? "bg-red-600 text-white border-red-600"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Disagree
            </button>
          </div>

          {agree === false && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Disagreeing tells the model the correct label is the opposite of "
              {result.prediction}". This is used to retrain the model with extra weight.
            </p>
          )}

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional: reason or suggestion (e.g., financial issue, academic issue)"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
          />

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
            {status === "saving" ? "Retraining model..." : "Submit Feedback"}
          </button>
        </>
      )}
    </div>
  );
}
