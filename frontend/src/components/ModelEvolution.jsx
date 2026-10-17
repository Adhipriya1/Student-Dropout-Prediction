import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../api";

export default function ModelEvolution({ refreshKey }) {
  const [coefs, setCoefs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.coefficientComparison().then(setCoefs).catch((e) => setError(e.message));
  }, [refreshKey]);

  if (error) return <div className="text-sm text-red-600">Failed to load model evolution: {error}</div>;
  if (!coefs) return <div className="text-sm text-slate-500">Loading model evolution...</div>;

  const hasChanged = coefs.some((c) => Math.abs(c.change) > 0.0001);
  const data = coefs.map((c) => ({ name: c.feature, Before: c.before, After: c.after }));

  return (
    <div className="visual-card bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="visual-card-heading">
        <div><p className="eyebrow">Human feedback loop</p><h2 className="text-lg font-semibold text-slate-800">Model Evolution</h2></div>
        <span className="chart-caption">Before / after</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Logistic Regression coefficients before vs. after incorporating teacher feedback
        (each correction is added to training with 5x sample weight and the model is refit).
      </p>

      {!hasChanged && (
        <p className="text-xs text-slate-400 mb-3">
          No teacher feedback has been applied yet — before and after are identical. Submit
          feedback above to see the model adapt.
        </p>
      )}

      <div className="chart-frame chart-frame-evolution chart-frame-tall">
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 2, bottom: 2 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="name" type="category" width={135} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => v.toFixed(4)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Before" fill="#17233d" radius={[0, 4, 4, 0]} />
        <Bar dataKey="After" fill="#087f83" radius={[0, 4, 4, 0]} />
      </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
