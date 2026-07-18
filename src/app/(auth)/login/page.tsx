"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconFridge, IconMessageCircleFilled, IconBrandGoogle } from "@tabler/icons-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { completeEmailAuth } from "./actions";

const KEEP_LOGIN_KEY = "fridge_keep_login";

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
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  // 초대 링크("OO 가족에 초대됐어요" 화면)의 회원가입/로그인 버튼이 넘겨주는 파라미터 —
  // 각각 어느 모드로 열지, 완료 후 어디로 돌아갈지(초대 링크 경로)를 함께 보존한다.
  const redirectParam = searchParams.get("redirect") ?? undefined;
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(KEEP_LOGIN_KEY);
    if (stored !== null) setKeepLoggedIn(stored === "true");
  }, []);

  const handleKeepLoggedInChange = (checked: boolean) => {
    setKeepLoggedIn(checked);
    localStorage.setItem(KEEP_LOGIN_KEY, String(checked));
  };

  const handleSocialClick = () => {
    showToast("준비 중이에요");
  };

  const handleEmailLogin = async () => {
    setError("");
    setNotice("");
    if (!email.trim() || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient({ persistSession: keepLoggedIn });
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
      await completeEmailAuth(redirectParam);
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
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient({ persistSession: keepLoggedIn });
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
        await completeEmailAuth(redirectParam);
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

  const switchMode = (next: "login" | "signup") => {
    setMode(next);
    setError("");
    setNotice("");
    setPasswordConfirm("");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="mb-16 flex flex-col items-center gap-2">
        <IconFridge size={40} className="text-ink" stroke={1.5} />
        <h1 className="text-[20px] font-medium text-ink">fridge</h1>
        <p className="text-[13px] text-stone">
          5초 안에 오늘 우리 집의 상태를 확인해요
        </p>
      </div>

      <div className="flex w-full max-w-[320px] flex-col gap-3">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          autoComplete="email"
          className="h-12 w-full rounded-2xl px-4 text-[15px]"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && mode === "login" && handleEmailLogin()}
          placeholder="비밀번호"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="h-12 w-full rounded-2xl px-4 text-[15px]"
        />

        {mode === "signup" && (
          <Input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
            placeholder="비밀번호 확인"
            autoComplete="new-password"
            className="h-12 w-full rounded-2xl px-4 text-[15px]"
          />
        )}

        {mode === "login" && (
          <label className="flex items-center gap-2 px-1 text-[13px] text-stone">
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(e) => handleKeepLoggedInChange(e.target.checked)}
              className="h-4 w-4 accent-sage"
            />
            로그인 상태 유지
          </label>
        )}

        {error && <p className="text-[12px] text-terra">{error}</p>}
        {notice && <p className="text-[12px] text-sage">{notice}</p>}

        {mode === "login" ? (
          <button
            onClick={handleEmailLogin}
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream disabled:opacity-50"
          >
            로그인
          </button>
        ) : (
          <button
            onClick={handleSignUp}
            disabled={isSubmitting}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[15px] font-medium text-cream disabled:opacity-50"
          >
            가입하기
          </button>
        )}

        {mode === "login" ? (
          <p className="text-center text-[12px] text-stone">
            아직 계정이 없나요?{" "}
            <button
              onClick={() => switchMode("signup")}
              className="font-medium text-ink underline underline-offset-2"
            >
              회원가입
            </button>
          </p>
        ) : (
          <p className="text-center text-[12px] text-stone">
            이미 계정이 있나요?{" "}
            <button
              onClick={() => switchMode("login")}
              className="font-medium text-ink underline underline-offset-2"
            >
              로그인
            </button>
          </p>
        )}

        {mode === "login" && (
          <>
            <div className="my-1 flex items-center gap-3">
              <span className="h-px flex-1 bg-border-light" />
              <span className="text-[11px] text-stone">또는</span>
              <span className="h-px flex-1 bg-border-light" />
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleSocialClick}
                aria-label="카카오로 시작하기"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE500]"
              >
                <IconMessageCircleFilled size={22} className="text-[#1A1A18]" />
              </button>
              <button
                onClick={handleSocialClick}
                aria-label="구글로 시작하기"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-btn-surface"
              >
                <IconBrandGoogle size={20} className="text-btn-surface-text" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
