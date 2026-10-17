import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

const RISK_COLORS = {
  Low: "#16a34a",
  Medium: "#d97706",
  High: "#dc2626",
};

export default function PredictionResult({ result }) {
  if (!result) return null;
  const { prediction, probability, risk_level, explanation } = result;
  const color = RISK_COLORS[risk_level] || "#6366f1";
  const pct = Math.round(probability * 100);

  return (
    <div className="visual-card bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="visual-card-heading">
        <div>
          <p className="eyebrow">Signal overview</p>
          <h2 className="text-lg font-semibold text-slate-800">Prediction Result</h2>
        </div>
        <span className="chart-caption">Model confidence</span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative w-40 h-40 shrink-0">
          <RadialBarChart
            width={160}
            height={160}
            innerRadius="70%"
            outerRadius="100%"
            data={[{ value: pct, fill: color }]}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar dataKey="value" cornerRadius={20} background clockWise />
          </RadialBarChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color }}>
              {pct}%
            </span>
            <span className="text-xs text-slate-500">risk score</span>
          </div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mb-2 ${
              prediction === "Dropout" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {prediction}
          </span>
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-3">
            <span className="text-sm text-slate-500">Risk Level:</span>
            <span className="font-semibold text-sm" style={{ color }}>
              {risk_level}
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{explanation}</p>
        </div>
      </div>
    </div>
  );
}
