import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function AcademicPerformance({ student }) {
  if (!student) return null;

  const unitsData = [
    { name: "Approved", "1st Sem": Number(student.units_1st_sem_approved), "2nd Sem": Number(student.units_2nd_sem_approved) },
    { name: "Enrolled (2nd only)", "1st Sem": 0, "2nd Sem": Number(student.units_2nd_sem_enrolled) },
  ];
  const gradeData = [
    { name: "Grade", "1st Sem": Number(student.units_1st_sem_grade), "2nd Sem": Number(student.units_2nd_sem_grade) },
  ];

  return (
    <div className="visual-card bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="visual-card-heading">
        <div>
          <p className="eyebrow">Student trajectory</p>
          <h2 className="text-lg font-semibold text-slate-800">Academic Performance</h2>
        </div>
        <span className="chart-caption">Two semesters</span>
      </div>
      <p className="text-sm text-slate-500 mb-4">Semester-by-semester units and grades for this student.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Curricular Units</p>
          <div className="chart-frame chart-frame-small">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={unitsData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="1st Sem" fill="#087f83" radius={[4, 4, 0, 0]} />
            <Bar dataKey="2nd Sem" fill="#f06449" radius={[4, 4, 0, 0]} />
          </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">Grades (0-20 scale)</p>
          <div className="chart-frame chart-frame-small">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={gradeData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 20]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="1st Sem" fill="#087f83" radius={[4, 4, 0, 0]} />
            <Bar dataKey="2nd Sem" fill="#f06449" radius={[4, 4, 0, 0]} />
          </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
