import React, { useState } from "react";

import Brand from "../components/Brand";
import LoginForm from "../components/auth/LoginForm";
import SignupForm from "../components/auth/SignupForm";

export default function AuthPage({ onLogin }) {
  const [page, setPage] = useState("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function switchPage() {
    setPage((current) => current === "login" ? "signup" : "login");
    setError("");
    setMessage("");
  }

  function handleRegistered() {
    setPage("login");
    setMessage("Account created. Log in with your new username and password.");
    setError("");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <p className="eyebrow">YOUR TEAM WORKSPACE</p>
        <h1>{page === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {page === "login" ? "Log in to continue to TaskFlow." : "Verify your email, then choose your login details."}
        </p>
        {error && <div className="notice error-notice" role="alert">{error}</div>}
        {message && <div className="notice success-notice" role="status">{message}</div>}

        {page === "login" ? (
          <LoginForm onLogin={onLogin} onError={setError} onMessage={setMessage} />
        ) : (
          <SignupForm onRegistered={handleRegistered} onError={setError} onMessage={setMessage} />
        )}

        <div className="auth-switch">
          {page === "login" ? "New to TaskFlow?" : "Already have an account?"}
          <button type="button" onClick={switchPage}>{page === "login" ? "Sign up" : "Log in"}</button>
        </div>
      </section>
    </main>
  );
}
