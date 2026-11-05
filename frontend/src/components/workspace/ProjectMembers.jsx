import React from "react";

export default function ProjectMembers({
  members,
  isOwner,
  email,
  onEmailChange,
  onAdd,
  busy,
  onRemove,
  allowRemoval = false,
  formId = "member-email",
}) {
  return (
    <section className={allowRemoval ? "management-section" : "members-panel"}>
      {allowRemoval ? (
        <div className="management-section-heading">
          <div><div className="eyebrow">COLLABORATION</div><h3>Manage members <span>({members.length})</span></h3></div>
        </div>
      ) : (
        <div className="members-panel-heading">
          <div><div className="eyebrow">COLLABORATION</div><h2>Project members</h2></div>
        </div>
      )}

      {isOwner && (
        <form className="member-add-form" onSubmit={onAdd}>
          <label htmlFor={formId}>Add an existing TaskFlow user by email</label>
          <div>
            <input id={formId} type="email" value={email} onChange={(event) => onEmailChange(event.target.value)} required placeholder="teammate@example.com" />
            <button className="primary-button" type="submit" disabled={busy}>{busy ? "Adding..." : "Add member"}</button>
          </div>
        </form>
      )}

      <ul className={`member-list${allowRemoval ? " management-member-list" : ""}`}>
        {members.map((member) => (
          <li key={member.user_id}>
            <span className="member-avatar">{member.username.charAt(0).toUpperCase()}</span>
            <span className="member-name"><strong>{member.username}</strong><small>{member.email}</small></span>
            <span className={`member-role ${member.role}`}>{member.role}</span>
            {allowRemoval && member.role !== "owner" && (
              <button type="button" className="danger-button" disabled={busy} onClick={() => onRemove(member)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
