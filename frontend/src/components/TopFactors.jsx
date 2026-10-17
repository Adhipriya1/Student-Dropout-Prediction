import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from "recharts";

export default function TopFactors({ factors }) {
  if (!factors) return null;
  const data = [...factors].slice(0, 5).map((f) => ({
    name: f.feature,
    value: f.coefficient,
  }));

  return (
    <div className="visual-card bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="visual-card-heading">
        <div><p className="eyebrow">Model drivers</p><h2 className="text-lg font-semibold text-slate-800">Top Risk Factors</h2></div>
        <span className="chart-caption">Top 5 signals</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Model coefficients: positive values raise dropout risk, negative values lower it.
      </p>
      <div className="chart-frame chart-frame-tall">
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => v.toFixed(3)} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? "#f06449" : "#087f83"} />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
