import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function ProgressPanel({ data }) {
  if (!data) return <div className="project-empty-state">Loading project analytics...</div>;
  return (
    <section className="insights-panel">
      <div className="eyebrow">PROJECT HEALTH</div>
      <h2>Progress</h2>
      <div className="analytics-metrics">
        <article><strong>{data.total_tasks}</strong><span>Total tasks</span></article>
        <article><strong>{data.completion_percentage}%</strong><span>Complete</span></article>
        <article><strong>{data.overdue_tasks}</strong><span>Overdue</span></article>
      </div>
      <div className="analytics-grid">
        <article className="chart-card">
          <h3>Tasks by status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.counts_by_status}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="count" fill="#6558e8" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="chart-card">
          <h3>Workload by member</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.workload_by_member}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="username" /><YAxis allowDecimals={false} /><Tooltip />
              <Bar dataKey="todo" stackId="tasks" fill="#9398a7" />
              <Bar dataKey="in_progress" stackId="tasks" fill="#4b91e2" />
              <Bar dataKey="done" stackId="tasks" fill="#49a778" />
            </BarChart>
          </ResponsiveContainer>
        </article>
        <article className="chart-card">
          <h3>Tasks completed per week</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.completed_per_week}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="week" /><YAxis allowDecimals={false} /><Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6558e8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </article>
      </div>
    </section>
  );
}
