import { useCallback, useEffect, useState } from "react";

import { ACCESS_TOKEN_KEY, getCurrentUser, loginWithPassword } from "../api/auth";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return () => { active = false; };
    }

    getCurrentUser(token)
      .then((account) => { if (active) setUser(account); })
      .catch(() => { localStorage.removeItem(ACCESS_TOKEN_KEY); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, []);

  const login = useCallback(async (username, password) => {
    const result = await loginWithPassword(username, password);
    localStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
    try {
      const account = await getCurrentUser(result.access_token);
      setUser(account);
      return account;
    } catch (error) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    setUser(null);
  }, []);

  return { user, loading, login, logout };
}
