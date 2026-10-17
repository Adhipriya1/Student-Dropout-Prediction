import { useEffect, useState } from "react";
import { api } from "../api";

export default function FeedbackLog({ refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.getFeedback().then(setEntries).catch(() => {});
  }, [refreshKey, open]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Feedback History</h2>
          <p className="text-sm text-slate-500">{entries.length} recorded feedback entr{entries.length === 1 ? "y" : "ies"}</p>
        </div>
        <span className="text-slate-400 text-sm">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
          {entries.length === 0 && <p className="text-sm text-slate-400">No feedback recorded yet.</p>}
          {[...entries].reverse().map((e, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between items-center mb-1">
                <span className={`font-medium ${e.prediction === "Dropout" ? "text-red-600" : "text-emerald-600"}`}>
                  {e.prediction} ({Math.round(e.probability * 100)}%)
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  e.agree ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {e.agree ? "Agreed" : "Disagreed"}
                </span>
              </div>
              {e.reason && <p className="text-slate-600">{e.reason}</p>}
              <p className="text-xs text-slate-400 mt-1">{new Date(e.timestamp).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
