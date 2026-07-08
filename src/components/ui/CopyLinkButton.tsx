"use client";

import { useEffect, useState } from "react";
import { IconCopy, IconCheck } from "@tabler/icons-react";

export function CopyLinkButton({ path }: { path: string }) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(`${window.location.origin}${path}`);
  }, [path]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border-light bg-surface px-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-[12px] text-stone">{url}</span>
      <button onClick={handleCopy} aria-label="링크 복사">
        {copied ? (
          <IconCheck size={16} className="text-sage" />
        ) : (
          <IconCopy size={16} className="text-stone" />
        )}
      </button>
    </div>
  );
}
