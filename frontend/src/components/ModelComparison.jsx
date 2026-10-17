import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api";

const METRIC_KEYS = ["accuracy", "precision", "recall", "f1_score"];

export default function ModelComparison({ refreshKey }) {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.modelComparison().then(setMetrics).catch((e) => setError(e.message));
  }, [refreshKey]);

  if (error) return <div className="text-sm text-red-600">Failed to load model comparison: {error}</div>;
  if (!metrics) return <div className="text-sm text-slate-500">Loading model comparison...</div>;

  const hasUpdated = !!metrics.updated_logistic_regression;

  const data = METRIC_KEYS.map((k) => ({
    metric: k.replace("_", " "),
    "Logistic Regression": metrics.logistic_regression[k],
    ...(hasUpdated ? { "Updated LR (HITL)": metrics.updated_logistic_regression[k] } : {}),
    "Random Forest": metrics.random_forest[k],
  }));

  return (
    <div className="visual-card bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="visual-card-heading">
        <div><p className="eyebrow">Evaluation lab</p><h2 className="text-lg font-semibold text-slate-800">Model Comparison</h2></div>
        <span className="chart-caption">Held-out test set</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Class-weighted Logistic Regression vs. Random Forest vs. the HITL-updated model,
        evaluated on the held-out test set.
      </p>

      <div className="chart-frame chart-frame-medium">
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => v.toFixed(3)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Logistic Regression" fill="#087f83" radius={[4, 4, 0, 0]} />
        {hasUpdated && <Bar dataKey="Updated LR (HITL)" fill="#f06449" radius={[4, 4, 0, 0]} />}
        <Bar dataKey="Random Forest" fill="#17233d" radius={[4, 4, 0, 0]} />
      </BarChart>
      </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Logistic Regression uses <code>class_weight={"{0:1,1:2}"}</code> to prioritize recall on
        dropout cases (Random Forest degrades recall on the minority "Dropout" class). "Updated LR"
        reflects the model after any teacher feedback has been applied.
      </p>
    </div>
  );
}
