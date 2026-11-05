import React from "react";

import Brand from "../Brand";

export default function WorkspaceSidebar({ user, onShowProjects }) {
  return (
    <aside className="workspace-sidebar">
      <Brand />
      <div className="workspace-label">WORKSPACE</div>
      <button className="workspace-nav active" onClick={onShowProjects}>
        <span aria-hidden="true">Projects</span> My projects
      </button>
      <div className="sidebar-account">
        <div className="avatar">{user.username.charAt(0).toUpperCase()}</div>
        <div className="sidebar-account-copy"><strong>{user.username}</strong><small>{user.email}</small></div>
      </div>
    </aside>
  );
}
