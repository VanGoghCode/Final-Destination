"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";

interface AuthContextType {
  passcode: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isNewUser: boolean;
  error: string | null;
  login: (code: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PASSCODE_KEY = "fd_passcode";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [passcode, setPasscode] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // On mount, check if there's a stored passcode and verify it
  useEffect(() => {
    const checkStoredPasscode = async () => {
      const stored = localStorage.getItem(PASSCODE_KEY);
      if (stored) {
        // Verify stored passcode with server
        try {
          const response = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ passcode: stored }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setPasscode(stored);
              setIsAuthenticated(true);
              setIsNewUser(data.isNewUser);
            }
          } else {
            // Invalid stored passcode, clear it
            localStorage.removeItem(PASSCODE_KEY);
          }
        } catch (err) {
          console.error("Failed to verify stored passcode:", err);
        }
      }
      setIsLoading(false);
    };

    checkStoredPasscode();
  }, []);

  const login = useCallback(async (code: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: code }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem(PASSCODE_KEY, code);
        setPasscode(code);
        setIsAuthenticated(true);
        setIsNewUser(data.isNewUser);
        setIsLoading(false);
        return true;
      } else {
        setError(data.error || "Authentication failed");
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Connection error. Please try again.");
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(PASSCODE_KEY);
    setPasscode(null);
    setIsAuthenticated(false);
    setIsNewUser(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        passcode,
        isAuthenticated,
        isLoading,
        isNewUser,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
