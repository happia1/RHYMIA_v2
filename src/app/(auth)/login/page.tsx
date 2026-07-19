"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconFridge, IconMessageCircleFilled, IconBrandGoogle } from "@tabler/icons-react";
import { useToast } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { signInAction, signUpAction } from "./actions";

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

// useSearchParams()를 쓰는 부분은 Suspense 경계 없이는 Vercel 프로덕션 빌드의 정적 프리렌더
// 단계에서 "should be wrapped in a suspense boundary" 에러로 실패한다(로컬은 FAT32라 next
// build를 못 돌려서 이 에러가 그동안 안 보였음) — 폼 전체를 LoginForm으로 빼고 default export
// 쪽에서 Suspense로 감싼다.
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
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
    try {
      // 로그인 자체(signInWithPassword)와 세션 쿠키 설정을 전부 서버 액션에서 수행 —
      // 서버 Set-Cookie로 내려가야 iOS Safari의 "JS(document.cookie)로 쓴 쿠키는 최대
      // 7일" 캡을 안 받는다(모바일에서 "로그인 상태 유지"를 켜도 며칠 만에 풀리던 문제의
      // 표준 회피 패턴).
      const result = await signInAction({
        email: email.trim(),
        password,
        keepLoggedIn,
        redirectTo: redirectParam,
      });
      if (result && !result.ok) setError(result.message);
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setError(
        err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했어요."
      );
    } finally {
      setIsSubmitting(false);
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
    try {
      const result = await signUpAction({
        email: email.trim(),
        password,
        keepLoggedIn,
        redirectTo: redirectParam,
      });
      if (result && !result.ok) {
        setError(result.message);
        return;
      }
      if (result?.needsEmailConfirmation) {
        setNotice("가입을 완료하려면 이메일함에서 인증 링크를 확인해주세요.");
      }
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setError(
        err instanceof Error ? err.message : "로그인 처리 중 오류가 발생했어요."
      );
    } finally {
      setIsSubmitting(false);
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
          <div className="flex flex-col gap-1 px-1">
            <label className="flex items-center gap-2 text-[13px] text-stone">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => handleKeepLoggedInChange(e.target.checked)}
                className="h-4 w-4 accent-sage"
              />
              로그인 상태 유지
            </label>
            {/* iOS는 세션 쿠키를 앱이 완전히 종료되거나 얼마 안 지나 정리해버리는 경우가
                많아, 껐을 때는 실제로 그럴 수 있다는 걸 미리 알려준다. */}
            {!keepLoggedIn && (
              <p className="text-[11px] text-[var(--text-muted)]">
                모바일에서는 앱을 닫으면 다시 로그인해야 할 수 있어요
              </p>
            )}
          </div>
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
