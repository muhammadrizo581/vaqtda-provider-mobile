// Auth konteksti — saytdagi context/AuthContext.tsx dan port.
// Yo'naltirish (redirect) bu yerda emas, app/_layout.tsx dagi guard'da qilinadi.
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Profile not found in profiles table, falling back to defaults.", error);
      }

      const fullName = profile?.full_name || "";
      const avatarUrl = profile?.avatar_url || null;
      const dbRole = (profile?.role || "client").toLowerCase();
      const role =
        dbRole === "admin"
          ? "admin"
          : dbRole === "provider" || dbRole === "specialist" || dbRole === "partner"
            ? "provider"
            : "client";

      setUser({
        id: userId,
        name: fullName || email.split("@")[0],
        email,
        avatar: avatarUrl,
        role,
      });
      setIsAuthenticated(true);
    } catch (e) {
      console.error("Error fetching profile", e);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await fetchProfile(session.user.id, session.user.email || "");
      }
      setLoading(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await fetchProfile(session.user.id, session.user.email || "");
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, user.email);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout, refreshProfile }}>
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
