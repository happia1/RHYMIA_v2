# 개발 참조 문서

## 마지막 업데이트: 2026-07-07

## 진행 현황

PRD(`PRD_fridge`) 9장 MVP 구현 범위 기준. ✅ 완료 / ⚠️ 부분 구현 / ❌ 미구현 / ❓ 미확인.

**인프라**
- ✅ Next.js 14 (App Router, TypeScript) + Tailwind CSS 세팅
- ✅ Supabase 연결 (Auth + DB + Storage 대신 이미지는 URL 텍스트 입력 방식으로 대체 — 실제 업로드 위젯 없음)
- ❓ Vercel 배포 — 로컬 개발 중심으로 진행되어 배포 여부 미확인

**인증**
- ✅ 카카오 / 구글 소셜 로그인
- ✅ 이메일/비밀번호 로그인·회원가입 (PRD 범위 밖 추가 구현)
- ✅ 가족 워크스페이스 생성 · 초대 링크

**홈 탭**
- ✅ 상단 헤더 (시간 · 날짜 · 날씨 · 인사말) — 2026-07-07 신규 추가, PRD 범위 밖
- ✅ 오늘 뭐먹지? 카드 — 2026-07-07 개편 (섹션 타이틀 카드 밖으로 이동, 참여자 표시 제거)
- ✅ 오늘 뭐하지? (오늘/이번주 토글)
- ✅ 지금 우리 가족은 (루틴 기반 상태 배지)
- ✅ 장바구니 (리스트 + 구매 체크)
- ✅ 게시판 (스티커/메모/공지)

**식탁 탭**
- ✅ 주간 달력 + 메뉴 카드
- ✅ 끼니 추가 전체화면
- ✅ 메뉴 상세 + 댓글 — 2026-07-07 하트(즐겨찾기) 버튼을 체크(참여) 버튼 옆으로 이동

**일정 탭**
- ✅ 월간 / 주간 / 연간 뷰 — 2026-07-07 월 라벨("2026년 7월") + 이전/다음 달 이동 버튼 추가
- ✅ 일정 등록 — 2026-07-07 종일 토글, 공유 대상 라벨("가족 전체"/"개인"), 준비물+메모 통합, 사진 URL, 알림 옵션(당일 오전/하루 전/일주일 전/직접 설정) 추가
- ✅ 그로서리 템플릿 (장소, 지출, 영수증 이미지)
- ✅ 루틴 설정 (원형/시간표 두 가지 보기)
- ✅ 다이어리 / 습관 / 할 일 템플릿 — 2026-07-07 신규, PRD 범위 밖 추가 기능. `+` 버튼이 4종 템플릿 선택 화면을 먼저 보여주도록 개편
  - ⚠️ 습관·할 일은 **등록 화면만 구현**, 목록/트래커 표시 화면은 없음
- ✅ 공휴일 표시 — 2026-07-07 신규, 정적 2026년 목록만 지원 (실시간 API 아님)
- ✅ AI Agent 버튼 — 2026-07-07 신규, **UI 자리만 있고 기능 없음** (플레이스홀더)

**설정 탭**
- ✅ 가족 구성원 관리 (리스트 뷰 — PRD의 "조직도 뷰"는 아님)
- ✅ 외부 공유 링크 생성 (읽기 전용, `/share/[workspaceId]`)
- ❌ 알림 설정 — 미구현

**P0-B 이후 (음성 에이전트, P1~P3)**: 미착수

## 프로젝트 구조

```
src/
  app/
    (auth)/login/          로그인/회원가입 페이지 + completeEmailAuth 액션
    (main)/                로그인 필요 영역 (레이아웃에서 ToastProvider + DockBar 적용)
      home/                홈 탭 (page.tsx가 서버에서 모든 홈 데이터 fetch)
      food/                식탁 탭 (목록, 끼니 추가, 상세[mealId])
      schedule/            일정 탭 (page.tsx, actions.ts, routine/ 하위 라우트)
      settings/            설정 탭
    auth/callback/         OAuth/이메일 인증 코드 교환 라우트 핸들러
    workspace/             워크스페이스 생성/가입 (join/[workspaceId])
    share/[workspaceId]/   비로그인 읽기 전용 공유 페이지
  components/
    home/                  HomeHeader, MealSummaryCard, TodayEvents, FamilyStatusCard, ShoppingList, BoardSection
    food/                  MealCard, MealDetail, AddMealScreen, WeekCalendar
    schedule/              MonthView/WeekView/YearView, AddEventEntry(+picker+4개 Sheet), EventFilters, RoutineEditor, PlaceInput, AiAssistButton
    ui/                    BottomSheet, Toast(+ToastProvider/useToast), Avatar, TagChip, CheckToggle, DockBar, CopyLinkButton
  lib/
    supabase/              client.ts(브라우저) / server.ts(서버, 쿠키 기반) / admin.ts(서비스 롤, 공유 페이지 전용) / middleware.ts(세션 갱신)
    workspace.ts            requireWorkspaceContext() — 로그인+워크스페이스 멤버십 가드, {supabase,user,workspaceId,role,displayName} 반환
    date.ts                  날짜 포맷/이동 유틸 (toDateStr, formatYearMonth, addMonths, WEEKDAY_LABEL 등)
    weather.ts               OpenWeatherMap 서버 전용 fetch 헬퍼 (키 없거나 실패 시 null)
    holidays.ts               2026년 KR 공휴일 정적 목록 (실 API 교체 지점 TODO 주석 있음)
    scheduleKeywords.ts       일정/할 일 공용 태그+색상 그룹 (KEYWORD_GROUPS)
    mealUtils.ts / routineUtils.ts   끼니/루틴 관련 계산 유틸
  types/index.ts            전체 테이블에 대응하는 TS 인터페이스
supabase/
  schema.sql                                              최초 전체 스키마 (참고용 — 라이브 DB에 직접 재실행하지 않음)
  fix_rls.sql / fix_rls_v2.sql                             family_workspace/workspace_member RLS 패치 (실행 완료)
  backfill_missing_user.sql                                누락된 users row 1건 수동 backfill (실행 완료)
  add_diary_habit_todo_and_schedule_columns.sql            diary/habit/todo 신규 테이블 + schedule 컬럼 추가 (실행 필요 여부 확인할 것)
middleware.ts                                              프로젝트 루트, 모든 요청에 대해 세션 갱신 (updateSession 위임)
```

## 환경변수

`.env.local`에 필요한 키 (값은 기록하지 않음):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENWEATHER_API_KEY` — 2026-07-07 추가, 홈/일정 탭 날씨 표시용

## Supabase 스키마 현황

**테이블 (17개)**: `family_workspace, users, workspace_member, routine, schedule, meal, meal_participation, meal_like, meal_comment, fridge_item, shopping_item, notice, expense, diary, habit, todo`

**헬퍼 함수**: `is_workspace_member(workspace_id)` (SECURITY DEFINER, workspace_member 자기 참조 재귀 회피용), `get_workspace_name(workspace_id)` (비멤버도 초대 링크 미리보기에서 워크스페이스 이름 확인 가능)

**RLS 정책 요약**
- `family_workspace`: INSERT(로그인 유저 누구나) / SELECT·UPDATE(`is_workspace_member`)
- `users`: INSERT·SELECT·UPDATE 모두 `auth.uid() = id` — **본인 row만 조회 가능**. workspace_member와 join해서 다른 가족 구성원의 `avatar_color`/`avatar_text_color`를 가져오는 여러 화면(홈, 설정, 일정)에서 RLS 때문에 다른 사용자 필드가 비어 보일 가능성 있음 — 실제 확인 필요 (아래 TODO 참고)
- `workspace_member`: SELECT(같은 워크스페이스 멤버끼리), INSERT/DELETE(본인 행만)
- `routine`, `habit`: 개인 소유 (`user_id = auth.uid()`), workspace 무관
- `schedule`, `meal`, `fridge_item`, `shopping_item`, `notice`, `expense`, `diary`, `todo`: 전체 CRUD `is_workspace_member(workspace_id)`
- `meal_participation`, `meal_like`, `meal_comment`: `meal.workspace_id`를 경유해 `is_workspace_member`로 확인

## 알려진 이슈 / TODO

- [ ] E 드라이브가 FAT32라서 `next build`(프로덕션 빌드)가 실패함 — NTFS 드라이브(C: 등)로 프로젝트 이전 필요. `next dev`는 정상 동작
- [ ] `users` 테이블 SELECT 정책이 본인 row로만 제한되어 있어, 다른 가족 구성원의 아바타 색상 등이 화면에서 비어 보일 수 있음 (미확인 — 브라우저에서 실제 확인 필요)
- [ ] 장소 검색: 카카오 로컬 API 키가 없어 텍스트 직접 입력만 지원 (`PlaceInput.tsx`에 교체 지점 TODO 주석)
- [ ] 공휴일: 실제 공공데이터포털 API 대신 2026년 정적 목록만 지원 (`holidays.ts`)
- [ ] 습관/할 일: 등록 화면만 있고 목록/트래커 화면 없음
- [ ] 설정 탭 알림 설정 미구현
- [ ] AI Agent 버튼 기능 미연결 (플레이스홀더)
- [ ] Vercel 배포 여부 미확인
- [ ] `supabase/add_diary_habit_todo_and_schedule_columns.sql`을 라이브 DB에 실행했는지 확인 필요 (실행 전에는 다이어리/습관/할 일/일정 사진·알림 기능이 DB 에러를 냄)

## 로컬 실행 방법

```bash
npm install
npm run dev
```
- http://localhost:3000 (포트 사용 중이면 3001/3002로 자동 변경됨)
- 최초 세팅 시 `.env.local`에 위 4개 환경변수 필요
- Supabase SQL Editor에서 아래 순서로 스크립트 실행 필요 (이미 실행했다면 재실행해도 안전):
  1. `supabase/fix_rls_v2.sql`
  2. `supabase/add_diary_habit_todo_and_schedule_columns.sql`
- `next build`는 FAT32 드라이브 이슈로 실패할 수 있음 — 변경 검증은 `next dev` + 브라우저/curl 확인으로 진행

---

### 유지 규칙
- 새 기능을 추가하거나 버그를 고칠 때마다 "진행 현황", "Supabase 스키마 현황", "알려진 이슈 / TODO" 를 그 자리에서 갱신한다.
- 값(API 키, 토큰 등)은 절대 이 파일에 기록하지 않는다 — 키 이름만.
