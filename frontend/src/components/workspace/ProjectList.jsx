import React from "react";

export default function ProjectList({ projects, onOpen }) {
  return (
    <div className="project-grid">
      {projects.map((project) => (
        <article className="project-card" key={project.id}>
          <div className="project-card-mark">{project.name.trim().charAt(0).toUpperCase()}</div>
          <h2>{project.name}</h2>
          <p>{project.description || "No description provided."}</p>
          <div className="project-card-footer">
            <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
            <button type="button" onClick={() => onOpen(project)}>
              Open project <span aria-hidden="true">-&gt;</span>
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
