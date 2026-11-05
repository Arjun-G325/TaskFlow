import { apiRequest } from "./client";

export const ACCESS_TOKEN_KEY = "taskflow_access_token";

export function sendSignupCode(email) {
  return apiRequest("/auth/email-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifySignupCode(email, code) {
  return apiRequest("/auth/email-code/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

export function verifyGoogleSignup(credential) {
  return apiRequest("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
}

export function registerAccount(signupToken, username, password) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ signup_token: signupToken, username, password }),
  });
}

export function loginWithPassword(username, password) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getCurrentUser(token) {
  return apiRequest("/auth/me", { token });
}
