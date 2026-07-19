"use client";

import { useEffect, useState } from "react";

export type DeviceLayout = "mobile" | "tablet-landscape" | "tablet-portrait";

// 고정 1024px 폭 기준을 폐기하고 "폭+방향" 조합으로 판단한다 — 아이패드 미니(1133×744)·
// 에어(1180×820) 둘 다 가로/세로 어느 방향으로 들어도 태블릿 레이아웃을 받아야 하는 게 기준.
// 가로 태블릿은 좁은 폭에서도 2/3단 배치가 부담스러우니 1000px, 세로 태블릿은 폭 자체가
// 좁아 700px으로 낮춰 잡는다.
const LANDSCAPE_QUERY = "(min-width: 1000px) and (orientation: landscape)";
const PORTRAIT_QUERY = "(min-width: 700px) and (orientation: portrait)";
// 폰을 가로로 눕힌 경우(짧은 높이) — 태블릿 폭 기준에는 못 미치지만(위 두 조건 모두 폭이
// 부족해 매치 안 됨) 모바일 레이아웃을 그대로 쓰기엔 세로 공간이 너무 좁다. 레이아웃 자체는
// 모바일 그대로 유지하되, 탭 page.tsx들의 "100dvh 고정+overflow-hidden(내부 스크롤만 허용)"
// 원칙만 풀어서 페이지 자체가 자연스럽게 늘어나며 스크롤되게 한다(TabPageFrame/ScrollRegion).
const PHONE_LANDSCAPE_QUERY = "(orientation: landscape) and (max-height: 500px)";

export interface DeviceLayoutState {
  layout: DeviceLayout;
  /** true면 layout은 항상 "mobile" — 폭이 태블릿 기준에 못 미치는 짧은 가로 화면(폰 회전). */
  isPhoneLandscape: boolean;
}

function resolveLayout(isLandscapeTablet: boolean, isPortraitTablet: boolean): DeviceLayout {
  if (isLandscapeTablet) return "tablet-landscape";
  if (isPortraitTablet) return "tablet-portrait";
  return "mobile";
}

const INITIAL_STATE: DeviceLayoutState = { layout: "mobile", isPhoneLandscape: false };

/** 홈/식탁/일정/게시판 4개 탭과 DockBar가 전부 이 훅 하나만 참조한다 — 탭마다 따로
 * `lg:`/`lg:landscape:` 같은 미디어쿼리를 넣지 않기 위한 유일한 분기 기준. 회전이나
 * 리사이즈는 matchMedia의 change 이벤트로 실시간 반영된다. 서버(SSR)에는 window가 없고,
 * 클라이언트 첫 렌더도 SSR 결과와 반드시 같아야 하이드레이션 경고가 안 나므로, 항상
 * "mobile"(+isPhoneLandscape:false)로 시작했다가 마운트 후 useEffect에서 실제 값으로
 * 갱신한다(DockBar가 예전에 자체적으로 쓰던 것과 같은 패턴). */
export function useDeviceLayout(): DeviceLayoutState {
  const [state, setState] = useState<DeviceLayoutState>(INITIAL_STATE);

  useEffect(() => {
    const landscapeMq = window.matchMedia(LANDSCAPE_QUERY);
    const portraitMq = window.matchMedia(PORTRAIT_QUERY);
    const phoneLandscapeMq = window.matchMedia(PHONE_LANDSCAPE_QUERY);

    const update = () =>
      setState({
        layout: resolveLayout(landscapeMq.matches, portraitMq.matches),
        isPhoneLandscape: phoneLandscapeMq.matches,
      });
    update();

    landscapeMq.addEventListener("change", update);
    portraitMq.addEventListener("change", update);
    phoneLandscapeMq.addEventListener("change", update);
    return () => {
      landscapeMq.removeEventListener("change", update);
      portraitMq.removeEventListener("change", update);
      phoneLandscapeMq.removeEventListener("change", update);
    };
  }, []);

  return state;
}
