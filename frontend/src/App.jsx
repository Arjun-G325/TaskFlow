import React from "react";

import AuthPage from "./pages/AuthPage";
import WorkspacePage from "./pages/WorkspacePage";
import { useAuth } from "./hooks/useAuth";

export default function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) {
    return (
      <main className="auth-page">
        <p className="auth-subtitle">Loading your workspace...</p>
      </main>
    );
  }

  return user ? (
    <WorkspacePage user={user} onLogout={logout} />
  ) : (
    <AuthPage onLogin={login} />
  );
}
