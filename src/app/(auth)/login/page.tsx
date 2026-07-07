"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { completeEmailAuth } from "./actions";

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (provider: "google" | "kakao") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleEmailLogin = async () => {
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (signInError) {
      setError("이메일 또는 비밀번호가 올바르지 않아요.");
      return;
    }

    try {
      await completeEmailAuth();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setError(
        err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했어요."
      );
    }
  };

  const handleSignUp = async () => {
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 해요.");
      return;
    }

    setIsSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      try {
        await completeEmailAuth();
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError(
          err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했어요."
        );
      }
    } else {
      setNotice("가입을 완료하려면 이메일함에서 인증 링크를 확인해주세요.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="mb-16 flex flex-col items-center gap-2">
        <span className="text-4xl">🧊</span>
        <h1 className="text-[20px] font-medium text-ink">fridge</h1>
        <p className="text-[13px] text-stone">
          5초 안에 오늘 우리 집의 상태를 확인해요
        </p>
      </div>

      <div className="flex w-full max-w-[320px] flex-col gap-3">
        <button
          onClick={() => handleLogin("kakao")}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#FEE500] text-[15px] font-medium text-[#1A1A18]"
        >
          카카오로 시작하기
        </button>
        <button
          onClick={() => handleLogin("google")}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[15px] font-medium text-ink"
        >
          구글로 시작하기
        </button>

        <div className="my-1 flex items-center gap-3">
          <span className="h-px flex-1 bg-border-light" />
          <span className="text-[11px] text-stone">또는</span>
          <span className="h-px flex-1 bg-border-light" />
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          autoComplete="email"
          className="h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-[15px] text-ink placeholder:text-stone focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
          placeholder="비밀번호"
          autoComplete="current-password"
          className="h-12 w-full rounded-2xl border border-border-light bg-white px-4 text-[15px] text-ink placeholder:text-stone focus:outline-none"
        />

        {error && <p className="text-[12px] text-terra">{error}</p>}
        {notice && <p className="text-[12px] text-sage">{notice}</p>}

        <button
          onClick={handleEmailLogin}
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream disabled:opacity-50"
        >
          로그인
        </button>
        <button
          onClick={handleSignUp}
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-[15px] font-medium text-ink disabled:opacity-50"
        >
          회원가입
        </button>
      </div>
    </div>
  );
}
