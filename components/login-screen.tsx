"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginPanel } from "@/components/login-panel";
import { ensurePendingTeamMember } from "@/lib/data-store";
import { getSupabaseClient } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type LoginScreenProps = {
  nextPath: string;
};

export function LoginScreen({ nextPath }: LoginScreenProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const authEnabled = Boolean(supabase);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setAuthMessage("Supabase が未設定のため、ログインは使えません。");
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        setAuthMessage(error.message);
      } else {
        setSession(data.session);
      }

      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!session || !supabase) {
      return;
    }

    ensurePendingTeamMember(supabase)
      .then(() => {
        router.replace(nextPath);
      })
      .catch((error) => {
        setAuthMessage(error instanceof Error ? error.message : "利用申請の作成に失敗しました。");
      });
  }, [nextPath, router, session, supabase]);

  async function sendMagicLink(email: string) {
    if (!supabase) {
      setAuthMessage("Supabase が未設定です。");
      return;
    }

    const redirectTo =
      typeof window === "undefined" ? undefined : `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setAuthMessage(error ? error.message : "ログインリンクを送りました。メールを確認してください。");
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setAuthMessage("Supabase が未設定です。");
      return;
    }

    const redirectTo =
      typeof window === "undefined" ? undefined : `${window.location.origin}/login?next=${encodeURIComponent(nextPath)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setAuthMessage(error.message);
    }
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    const { error } = await supabase.auth.signOut();
    setAuthMessage(error ? error.message : "ログアウトしました。");
  }

  return (
    <main className="page-shell login-page-shell">
      <LoginPanel
        authEnabled={authEnabled}
        authLoading={authLoading}
        authMessage={authMessage}
        session={session}
        onSendMagicLink={sendMagicLink}
        onSignInWithGoogle={signInWithGoogle}
        onSignOut={signOut}
      />
    </main>
  );
}
