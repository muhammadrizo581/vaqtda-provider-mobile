// Auth konteksti — saytdagi context/AuthContext.tsx dan port.
// Yo'naltirish (redirect) bu yerda emas, app/_layout.tsx dagi guard'da qilinadi.
import React, { createContext, useContext, useEffect, useState } from "react";
import { clearPushToken } from "@/lib/push";
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
  login: (identifier: string, password: string) => Promise<{ error?: string }>;
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

      // Panelga kirish huquqi: provayder roli YOKI klinikaga biriktirilgan
      // shifokor (provider_staff.user_id) yoki emailiga taklif yuborilgan xodim.
      // Shifokor boshqa joyda mijoz ham bo'lishi mumkin — shuning uchun rolni
      // o'zgartirmaymiz, faqat kirishga ruxsat beramiz.
      let allowed = role === "provider";
      if (!allowed) {
        const { data: canAccess } = await supabase.rpc("can_access_provider_panel");
        allowed = canAccess === true;
      }

      if (!allowed) {
        // Ruxsati yo'q akkaunt panelga kirmaydi — sessiya jimgina yopiladi.
        // setTimeout: onAuthStateChange callback ichida auth metodini chaqirish deadlock beradi.
        setUser(null);
        setIsAuthenticated(false);
        setTimeout(() => {
          supabase.auth.signOut();
        }, 0);
        return;
      }

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

  // identifier: email YOKI username. "@" bo'lmasa username deb qaraladi va
  // email_for_username RPC orqali emailga aylantiriladi (migratsiya: profile_usernames).
  const login = async (identifier: string, password: string) => {
    let email = identifier.trim();
    if (!email.includes("@")) {
      const { data: resolved } = await supabase.rpc("email_for_username", { uname: email });
      let target = (resolved as string | null) || null;
      if (!target) {
        // Klinika xodimi logini (masalan "akfa-medline.ali-qosimov") —
        // biznes egasi yaratgan akkaunt, worker_credentials jadvalida
        const { data: workerEmail } = await supabase.rpc("worker_email_for_username", {
          p_login: email,
        });
        target = (workerEmail as string | null) || null;
      }
      if (!target) return { error: "invalid_credentials" };
      email = target;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Rol tekshiruvi: provayder bo'lmasa sessiya yopiladi va xato matni
    // parol xatosidan farq qilmaydi — rol haqida hech narsa oshkor qilinmaydi.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const dbRole = (profile?.role || "client").toLowerCase();
    let isProvider = dbRole === "provider" || dbRole === "specialist" || dbRole === "partner";
    if (!isProvider) {
      // Klinika xodimi (shifokor) ham panelga kiradi — o'z jadvali va bronlari uchun
      const { data: canAccess } = await supabase.rpc("can_access_provider_panel");
      isProvider = canAccess === true;
    }
    if (!isProvider) {
      await supabase.auth.signOut();
      return { error: "invalid_credentials" };
    }
    return {};
  };

  const logout = async () => {
    // Chiqishdan oldin push token tozalanadi — eski qurilmaga xabar bormasin
    if (user) await clearPushToken(user.id);
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
