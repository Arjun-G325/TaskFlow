const columns = [
  { title: "To Do", count: "0", tone: "slate" },
  { title: "In Progress", count: "0", tone: "blue" },
  { title: "Done", count: "0", tone: "green" },
];

export default function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" aria-label="TaskFlow home">
          <span className="brand-mark">T</span>
          <span>taskflow</span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button className="nav-item active"><span>▦</span> My projects</button>
        <button className="nav-item"><span>◷</span> My tasks</button>
        <div className="sidebar-bottom"><div className="avatar">Y</div><div><strong>Your workspace</strong><small>Free plan</small></div><span className="more">···</span></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="breadcrumbs">Projects <span>/</span> <strong>Website redesign</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♧</button><div className="avatar small">Y</div></div></header>
        <div className="content">
          <div className="project-heading"><div><div className="eyebrow">PROJECT</div><h1>Website redesign</h1><p>Plan, track, and ship your team’s best work.</p></div><button className="primary-button">＋ <span>New task</span></button></div>
          <div className="board-toolbar"><div className="view-tabs"><button className="selected">Board</button><button>Activity</button><button>Progress</button></div><button className="filter-button">☷ <span>Filter</span></button></div>
          <div className="board">
            {columns.map((column) => (
              <section className="board-column" key={column.title}>
                <div className="column-heading"><div><span className={`status-dot ${column.tone}`} /><h2>{column.title}</h2><span className="count">{column.count}</span></div><button aria-label={`More ${column.title} options`}>···</button></div>
                <div className="empty-column"><span className="empty-icon">＋</span><span>No tasks yet</span></div>
                <button className="add-task">＋ Add task</button>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
