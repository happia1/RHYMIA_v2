export interface KeywordGroup {
  main: string;
  color: string;
  subs: string[];
}

export const KEYWORD_GROUPS: KeywordGroup[] = [
  { main: "공휴일", color: "#D96B5A", subs: ["법정공휴일", "대체공휴일"] },
  { main: "여행", color: "#3D7EAA", subs: ["국내여행", "해외여행", "당일치기"] },
  { main: "행사", color: "#E8A04A", subs: ["생일", "기념일", "기일", "결혼식", "장례식"] },
  {
    main: "교육",
    color: "#5BAD7F",
    subs: ["방학", "시험", "현장학습", "입학", "졸업"],
  },
  { main: "건강", color: "#E8416A", subs: ["병원", "검진", "예방접종"] },
  { main: "기타", color: "#888780", subs: [] },
];

export function getKeywordColor(main: string | null) {
  return KEYWORD_GROUPS.find((g) => g.main === main)?.color ?? "#888780";
}
