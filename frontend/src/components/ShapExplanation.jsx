import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from "recharts";

export default function ShapExplanation({ shap }) {
  if (!shap) return null;
  const data = shap.map((s) => ({ name: s.feature, value: s.shap_value, input: s.input_value }));

  return (
    <div className="visual-card bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="visual-card-heading">
        <div><p className="eyebrow">Explainability</p><h2 className="text-lg font-semibold text-slate-800">SHAP Explanation</h2></div>
        <span className="chart-caption">Student-level view</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        How each input pushed this student's prediction toward or away from dropout.
      </p>
      <div className="chart-frame chart-frame-tall">
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <ReferenceLine x={0} stroke="#94a3b8" />
        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v, n, p) => [`${v.toFixed(3)} (value: ${p.payload.input})`, "SHAP contribution"]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? "#f06449" : "#087f83"} />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-red-600 inline-block" /> increases risk
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" /> decreases risk
        </span>
      </div>
    </div>
  );
}
