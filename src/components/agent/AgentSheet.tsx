"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconX, IconCamera, IconMicrophone, IconSend } from "@tabler/icons-react";
import { ConfirmCards } from "./ConfirmCards";
import { Input } from "@/components/ui/Input";
import {
  callAgent,
  type AgentSchedule,
  type AgentMemberOption,
  type AgentRoutine,
} from "@/lib/agentApi";
import { compressImage } from "@/lib/imageCompress";
import { mirror } from "@/lib/homeTheme";

type ChatMessage =
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "user"; kind: "image"; imageDataUrl: string }
  | { id: string; role: "agent"; kind: "text"; text: string }
  | { id: string; role: "agent"; kind: "loading" }
  | {
      id: string;
      role: "agent";
      kind: "cards";
      schedules: AgentSchedule[];
      routines: AgentRoutine[];
      routineTargetHint: string | null;
    }
  | { id: string; role: "agent"; kind: "error"; text: string };

let idCounter = 0;
const nextId = () => `m${Date.now()}_${idCounter++}`;

const GREETING = "일정이 담긴 사진이나 텍스트, 또는 하루 일과를 알려주세요.";

export function AgentSheet({
  open,
  onClose,
  workspaceId,
  members,
  currentMemberId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  members: AgentMemberOption[];
  currentMemberId: string;
}) {
  const [mounted, setMounted] = useState(open);
  const [fullscreen, setFullscreen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: nextId(), role: "agent", kind: "text", text: GREETING },
  ]);
  const [inputText, setInputText] = useState("");
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!mounted) return null;

  const handleGripDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
  };

  const handleGripUp = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;
    if (delta < -40) {
      setFullscreen(true);
    } else if (delta > 80) {
      if (fullscreen) setFullscreen(false);
      else onClose();
    }
  };

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m]);
  const replaceMessage = (id: string, m: ChatMessage) =>
    setMessages((prev) => prev.map((x) => (x.id === id ? m : x)));

  const runAgent = async (body: { user_text?: string; image_base64?: string }, isResume: boolean) => {
    setSending(true);
    const loadingId = nextId();
    pushMessage({ id: loadingId, role: "agent", kind: "loading" });

    try {
      const res = await callAgent(
        isResume && pendingThreadId
          ? { thread_id: pendingThreadId, user_reply: body.user_text }
          : body
      );

      if (res.status === "need_input") {
        setPendingThreadId(res.thread_id);
        replaceMessage(loadingId, { id: loadingId, role: "agent", kind: "text", text: res.message });
      } else {
        setPendingThreadId(null);
        replaceMessage(loadingId, {
          id: loadingId,
          role: "agent",
          kind: "cards",
          schedules: res.schedules,
          routines: res.routines,
          routineTargetHint: res.target_hint,
        });
      }
    } catch (err) {
      // agentApi.ts의 callAgent가 서버 메시지를 그대로 Error.message로 던진다 — 에이전트 서버가
      // 꺼져 있는 경우 등은 "agent_http_" 접두사가 아닌 사람이 읽을 메시지이므로 그대로 보여준다.
      const message =
        err instanceof Error && err.message && !err.message.startsWith("agent_http_")
          ? err.message
          : "잠시 후 다시 시도해주세요.";
      replaceMessage(loadingId, {
        id: loadingId,
        role: "agent",
        kind: "error",
        text: message,
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendText = () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText("");
    pushMessage({ id: nextId(), role: "user", kind: "text", text });
    runAgent({ user_text: text }, Boolean(pendingThreadId));
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || sending) return;

    const dataUrl = await compressImage(file);
    pushMessage({ id: nextId(), role: "user", kind: "image", imageDataUrl: dataUrl });
    // 이미지 첨부는 항상 새 요청으로 취급 (need_input 재개는 텍스트 답변 전용)
    setPendingThreadId(null);
    runAgent({ image_base64: dataUrl }, false);
  };

  const handleCardsProcessed = (summary: { registered: number; skipped: number }) => {
    pushMessage({
      id: nextId(),
      role: "agent",
      kind: "text",
      text: `${summary.registered}개 등록 · ${summary.skipped}개 건너뜀`,
    });
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end transition-opacity duration-200 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onClick={onClose}
      onTransitionEnd={() => {
        if (!open) {
          setMounted(false);
          setFullscreen(false);
        }
      }}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 flex w-full flex-col rounded-t-3xl bg-surface transition-[height,transform] duration-200 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: fullscreen ? "100vh" : "78vh" }}
      >
        <div
          onPointerDown={handleGripDown}
          onPointerUp={handleGripUp}
          className="flex shrink-0 touch-none items-center justify-between px-4 pb-2 pt-3"
        >
          <div className="w-5" />
          <div className="mx-auto h-1 w-9 shrink-0 cursor-grab rounded-full bg-[#E8E6E0]" />
          <button onClick={onClose} aria-label="닫기" className={mirror.muted}>
            <IconX size={18} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2">
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                workspaceId={workspaceId}
                members={members}
                currentMemberId={currentMemberId}
                onCloseSheet={onClose}
                onCardsProcessed={handleCardsProcessed}
              />
            ))}
          </div>
        </div>

        <div className={`flex shrink-0 items-center gap-2 border-t px-4 py-3 ${mirror.hairline}`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="이미지 첨부"
            disabled={sending}
            className={`${mirror.muted} disabled:opacity-40`}
          >
            <IconCamera size={22} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder="일정을 알려주세요"
            disabled={sending}
            className="h-10 flex-1 rounded-full px-4 text-[13px]"
          />
          <button disabled aria-label="음성 입력 (준비 중)" className="text-stone/40">
            <IconMicrophone size={22} />
          </button>
          <button
            onClick={handleSendText}
            disabled={sending || !inputText.trim()}
            aria-label="전송"
            className="text-honey disabled:text-stone/40"
          >
            <IconSend size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  workspaceId,
  members,
  currentMemberId,
  onCloseSheet,
  onCardsProcessed,
}: {
  message: ChatMessage;
  workspaceId: string;
  members: AgentMemberOption[];
  currentMemberId: string;
  onCloseSheet: () => void;
  onCardsProcessed: (summary: { registered: number; skipped: number }) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        {message.kind === "text" ? (
          <div className="max-w-[75%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-[13px] text-cream">
            {message.text}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.imageDataUrl}
            alt="첨부한 이미지"
            className="max-h-40 max-w-[65%] rounded-2xl object-cover"
          />
        )}
      </div>
    );
  }

  if (message.kind === "loading") {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-cream px-4 py-3">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone" />
        </div>
      </div>
    );
  }

  if (message.kind === "cards") {
    return (
      <ConfirmCards
        workspaceId={workspaceId}
        members={members}
        currentMemberId={currentMemberId}
        schedules={message.schedules}
        routines={message.routines}
        routineTargetHint={message.routineTargetHint}
        onAllProcessed={onCardsProcessed}
      />
    );
  }

  if (message.kind === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-cream px-3.5 py-2.5 text-[13px] text-ink">
          <p>{message.text}</p>
          <Link
            href="/schedule"
            onClick={onCloseSheet}
            className="mt-1 inline-block text-[12px] font-medium text-honey underline underline-offset-2"
          >
            수동으로 등록하기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-cream px-3.5 py-2.5 text-[13px] text-ink">
        {message.text}
      </div>
    </div>
  );
}
