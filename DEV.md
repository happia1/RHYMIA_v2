# 개발 참조 문서

## 마지막 업데이트: 2026-07-07 (홈 화면 "스마트미러" 전면 재구성 + 다크/라이트 테마)

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

**다크/라이트 테마 시스템** — 2026-07-07 신규
- ✅ CSS 변수 기반(`--bg-page`, `--text-primary`, `--text-secondary`, `--text-muted`, `--hairline`, 공통 `--accent-honey`/`--accent-sage`), `globals.css`에 라이트(기본) + `@media (prefers-color-scheme: dark)` + `[data-theme="light"|"dark"]` 명시적 오버라이드로 정의
- ✅ `ThemeProvider`(`src/components/ui/ThemeProvider.tsx`) — `localStorage`(`fridge-theme` 키)에 저장, 선택하지 않으면 시스템 설정을 그대로 따름. 값은 DB가 아니라 브라우저 로컬 저장소에만 있음 (기기별로 따로 적용됨 — 여러 기기 동기화가 필요해지면 `users` 테이블 컬럼으로 옮겨야 함)
- ✅ 루트 레이아웃에 하이드레이션 전 깜빡임 방지용 인라인 스크립트 추가
- ✅ 설정 탭에 "화면 모드" 라이트/다크/시스템 설정 토글 (`ThemeToggle`)
- ⚠️ **현재는 홈 화면만 이 테마를 실제로 반영함.** 식탁/일정/게시판/설정 탭은 기존 `cream`/`ink`/`stone` 고정 라이트 팔레트를 그대로 사용 — 다크 모드에서 홈↔다른 탭 전환 시 배경색이 급격히 바뀌는 것은 의도된 과도기 상태 (사용자가 "홈 화면과 테마 시스템만 먼저" 진행을 명시적으로 요청함)
- ⚠️ 독바(`DockBar`)는 배경/테두리를 없애고 테마 변수 기반 텍스트 색을 쓰도록 이미 바꿔서, 다크 모드일 때 아직 라이트로 남아있는 다른 탭 위에서는 독바 글자가 옅게(무채색) 보일 수 있음 — 다른 탭도 테마 대응하면 자연히 해결됨

**홈 탭** — 2026-07-07 "스마트미러" 스타일로 전면 재구성 (카드/배경 박스 전부 제거, 타이포그래피+헤어라인+여백만으로 구획)
- ✅ 상단 헤더 — 왼쪽 시간(56px, 얇은 웨이트)+AM/PM, 날짜·요일·날씨 한 줄, 그 아래 [본인 아바타(18px, 표시 전용)+상태]. 오른쪽 🔔알림(`/notifications`)·⚙️설정(`/settings`) 아이콘만(배경 없음). "OO님 안녕하세요" 텍스트 없음
- ✅ 오늘 뭐먹지 — 가로 스와이프 캐러셀, 오늘 등록된 끼니 전부 시간순 정렬, 메뉴명 26px + "태그·타입·시간" + "+ 사이드·참여자 이름" 보조줄. 점 인디케이터는 활성 시 honey 색 길쭉한 필. 카드 배경 없음 (버그 수정 이력은 `DEBUG_LOG.md` 참고)
- ✅ 오늘 뭐하지 — 각 행 `[시간(honey, tabular-nums, 고정폭)] [제목] [대상(흐림)]`, 헤어라인으로 위 섹션과 구분
- ✅ 지금 우리 가족은 — 아바타 원 없이 텍스트만 `[이름(고정폭)] [상태] [이모지]`, **본인 제외**(본인 상태는 헤더에 이미 있음)
- ✅ 게시판 미리보기 — 좌우 2열(블록 없음): 왼쪽 스티커(작성자+내용+D-N, 전부 흐림/작게), 오른쪽 장바구니(3px sage 도트+이름, 4개+"외 N개"). 전체는 `/board`로 링크
- ✅ 태블릿(lg: 1024px~) 3단 컬럼 — `grid-cols-mirror`(1fr 1.4fr 1fr) 토큰, 좌: 헤더 정보(세로 중앙) / 중: 끼니+일정+가족 / 우: 게시판 미리보기, 컬럼 사이 헤어라인. 모바일은 그대로 세로 스택
- ✅ 여백/색상 전부 토큰화: `tailwind.config.ts`의 `spacing.section`(30px)/`label-gap`(12px)/`row`(7px), `src/lib/homeTheme.ts`의 `mirror.*` (CSS 변수 참조 클래스 모음) — 하드코딩 없음

**프로필 이미지** — 2026-07-07 신규
- ✅ `users.avatar_image_url` 컬럼 + Supabase Storage `avatars` 버킷(퍼블릭 읽기, 본인 폴더만 쓰기) 추가
- ✅ 설정 탭에 업로드 UI (`AvatarUploader`) — 파일 선택 시 브라우저에서 Storage에 직접 업로드 후 서버 액션으로 `avatar_image_url` 갱신, "기본 이미지로 되돌리기" 지원
- ✅ `Avatar` 컴포넌트가 `imageUrl` prop을 받으면 이미지로, 없으면 기존 이니셜로 폴백. 끼니상세·카드/설정 등 아바타 노출 지점에 반영 (홈 화면은 "스마트미러" 재구성으로 원형 아바타 대부분 제거 — 헤더의 작은 아바타만 남음)

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

**게시판 탭** (`/board`) — 독바에서 "설정"을 대체. 2026-07-07 60/40 2단 그리드(`grid-cols-board` 토큰)로 재개편, 모바일도 동일 비율
- ✅ 왼쪽(60%) 스티커/메모/공지: 스티커는 카드 안에 작성자(작게·옅게)+내용, D-N 배지는 카드 **밖** 오른쪽 아래로 이동, 댓글 없음. 메모/공지는 작성자·시간 헤더 + 내용 미리보기, 공지는 제목 앞 📌 표시(기존 `is_pinned` 상단고정과는 별개 개념)
- ✅ 메모/공지 댓글 — 2026-07-07 신규 `notice_comment` 테이블 + `addNoticeComment` (`meal_comment`/`addMealComment` 패턴 그대로 미러링). 스티커는 댓글 없음
- ✅ 오른쪽(40%) 장바구니 전체 관리 (`ShoppingList`, 추가/체크/삭제), 내부 스크롤(`max-h-[70vh]`)로 좌측 컬럼과 독립적으로 스크롤
- `addNotice`/`deleteNotice`/`addNoticeComment` 액션은 `home/actions.ts`에서 `board/actions.ts`로 이동함 (게시판이 독립 라우트가 됐으므로)

**알림** (`/notifications`) — 2026-07-07 신규, 헤더의 🔔 아이콘으로만 진입 (독바에 없음, `/settings`와 동일한 진입 방식)
- ✅ `notice` 테이블에서 `type = 'notice'`인 항목만 시간순으로 나열, 각 항목에 "게시판에서 보기" 링크. 댓글 등 상호작용은 게시판 탭에 집중, 여기선 읽기 전용 요약만

**설정 탭** (`/settings`) — 독바에서 빠지고, 홈 헤더의 ⚙️ 아이콘으로 진입 (라우트 자체는 그대로 존재)
- ✅ 프로필 이미지 업로드 (위 "프로필 이미지" 참고)
- ✅ 가족 구성원 관리 (리스트 뷰 — PRD의 "조직도 뷰"는 아님)
- ✅ 외부 공유 링크 생성 (읽기 전용, `/share/[workspaceId]`)
- ❌ 알림 설정 — 미구현 (여기서 "알림"은 PRD의 push/설정 항목이며, 위의 `/notifications` 공지 목록과는 다른 개념)

**P0-B 이후 (음성 에이전트, P1~P3)**: 미착수

## 프로젝트 구조

```
src/
  app/
    (auth)/login/          로그인/회원가입 페이지 + completeEmailAuth 액션
    (main)/                로그인 필요 영역 (레이아웃에서 ToastProvider + DockBar 적용)
      home/                홈 탭 (page.tsx가 서버에서 모든 홈 데이터 fetch, actions.ts에 장바구니/게시판/끼니참여 액션)
      food/                식탁 탭 (목록, 끼니 추가, 상세[mealId])
      schedule/            일정 탭 (page.tsx, actions.ts, routine/ 하위 라우트)
      board/               게시판 탭 (page.tsx, actions.ts — addNotice/deleteNotice/addNoticeComment)
      notifications/       알림 페이지 — 2026-07-07 신규, 공지(type=notice) 목록만
      settings/            설정 탭 (page.tsx, actions.ts — signOut + updateAvatarImage/clearAvatarImage). 독바에서 빠짐, 헤더 ⚙️로만 진입
    auth/callback/         OAuth/이메일 인증 코드 교환 라우트 핸들러
    workspace/             워크스페이스 생성/가입 (join/[workspaceId])
    share/[workspaceId]/   비로그인 읽기 전용 공유 페이지
  components/
    home/                  HomeHeader/MealSummaryCard/TodayEvents/FamilyStatusCard — 2026-07-07 전부 "스마트미러" 스타일로 재작성(카드 제거, mirror.* 토큰 사용). BoardPreview(신규, 홈 미리보기 2열), ShoppingList(게시판 탭 전체 관리용, 홈에서는 더 이상 안 씀), BoardSection(게시판 탭, 60/40+댓글)
    food/                  MealCard, MealDetail, AddMealScreen, WeekCalendar
    schedule/              MonthView/WeekView/YearView, AddEventEntry(+picker+4개 Sheet), EventFilters, RoutineEditor, PlaceInput, AiAssistButton
    settings/              AvatarUploader(프로필 이미지 업로드), ThemeToggle(2026-07-07 신규, 화면 모드 전환)
    ui/                    BottomSheet, Toast(+ToastProvider/useToast), ThemeProvider(2026-07-07 신규, useTheme 훅+localStorage 영속화), Avatar(imageUrl 지원), TagChip, CheckToggle, DockBar(2026-07-07 배경/테두리 제거), CopyLinkButton
  lib/
    supabase/              client.ts(브라우저, avatar 업로드에도 사용) / server.ts(서버, 쿠키 기반) / admin.ts(서비스 롤, 공유 페이지 전용) / middleware.ts(세션 갱신)
    workspace.ts            requireWorkspaceContext() — 로그인+워크스페이스 멤버십 가드, {supabase,user,workspaceId,role,displayName} 반환
    members.ts               mapWorkspaceMembers() — workspace_member+users 조인 결과를 화면용 형태로 변환하는 공용 헬퍼
    uiTokens.ts               AVATAR_SIZE(mirror 18px 추가), SHOPPING_DOT_SIZE — 여러 컴포넌트가 공유하는 크기값
    homeTheme.ts              2026-07-07 신규: mirror.* — 홈 화면 전용 CSS 변수 참조 클래스 모음(bg/primary/secondary/muted/hairline/label). 다른 탭의 cream/ink/stone과는 별개 팔레트
    date.ts                  날짜 포맷/이동 유틸 (toDateStr, formatYearMonth, addMonths, formatPostTimestamp, WEEKDAY_LABEL 등)
    weather.ts               OpenWeatherMap 서버 전용 fetch 헬퍼 (키 없거나 실패 시 null)
    holidays.ts               2026년 KR 공휴일 정적 목록 (실 API 교체 지점 TODO 주석 있음)
    scheduleKeywords.ts       일정/할 일 공용 태그+색상 그룹 (KEYWORD_GROUPS)
    mealUtils.ts / routineUtils.ts   끼니/루틴 관련 계산 유틸
  types/index.ts            전체 테이블에 대응하는 TS 인터페이스 (NoticeComment 2026-07-07 추가)
tailwind.config.ts                                        2026-07-07: gridTemplateColumns.board = "3fr 2fr" (게시판 60/40 비율 토큰)
supabase/
  schema.sql                                              최초 전체 스키마 (참고용 — 라이브 DB에 직접 재실행하지 않음)
  fix_rls.sql / fix_rls_v2.sql                             family_workspace/workspace_member RLS 패치 (실행 완료)
  backfill_missing_user.sql                                누락된 users row 1건 수동 backfill (실행 완료)
  add_diary_habit_todo_and_schedule_columns.sql            diary/habit/todo 신규 테이블 + schedule 컬럼 추가 (실행 여부 확인 필요)
  add_notice_comment_and_avatar_storage.sql                2026-07-07 신규: notice_comment 테이블 + users.avatar_image_url + avatars Storage 버킷/정책 (실행 필요)
middleware.ts                                              프로젝트 루트, 모든 요청에 대해 세션 갱신 (updateSession 위임)
```

## 환경변수

`.env.local`에 필요한 키 (값은 기록하지 않음):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENWEATHER_API_KEY` — 2026-07-07 추가, 홈/일정 탭 날씨 표시용

## Supabase 스키마 현황

**테이블 (18개)**: `family_workspace, users, workspace_member, routine, schedule, meal, meal_participation, meal_like, meal_comment, fridge_item, shopping_item, notice, notice_comment, expense, diary, habit, todo`

**헬퍼 함수**: `is_workspace_member(workspace_id)` (SECURITY DEFINER, workspace_member 자기 참조 재귀 회피용), `get_workspace_name(workspace_id)` (비멤버도 초대 링크 미리보기에서 워크스페이스 이름 확인 가능)

**Storage**: `avatars` 버킷(퍼블릭) — 2026-07-07 신규. 경로 규칙 `avatars/{user_id}/{filename}`, 읽기는 공개, 쓰기(INSERT/UPDATE)는 `auth.uid() = 첫 폴더명`인 경우만 허용

**RLS 정책 요약**
- `family_workspace`: INSERT(로그인 유저 누구나) / SELECT·UPDATE(`is_workspace_member`)
- `users`: INSERT·SELECT·UPDATE 모두 `auth.uid() = id` — **본인 row만 조회 가능**. workspace_member와 join해서 다른 가족 구성원의 `avatar_color`/`avatar_text_color`/`avatar_image_url`를 가져오는 여러 화면(홈, 설정, 일정, 식탁, 게시판)에서 RLS 때문에 다른 사용자 필드가 비어 보일 가능성 있음 — **2026-07-07 기준 아직 미확인이며, 이번에 추가한 프로필 이미지 기능이 통째로 안 보일 수도 있는 원인** (아래 TODO 최우선 항목 참고)
- `workspace_member`: SELECT(같은 워크스페이스 멤버끼리), INSERT/DELETE(본인 행만)
- `routine`, `habit`: 개인 소유 (`user_id = auth.uid()`), workspace 무관
- `schedule`, `meal`, `fridge_item`, `shopping_item`, `notice`, `expense`, `diary`, `todo`: 전체 CRUD `is_workspace_member(workspace_id)`
- `meal_participation`, `meal_like`, `meal_comment`, `notice_comment`: 각각 부모(`meal`/`notice`)의 `workspace_id`를 경유해 `is_workspace_member`로 확인

## 알려진 이슈 / TODO

- [ ] **최우선 확인 필요**: `users` 테이블 SELECT 정책이 본인 row로만 제한되어 있어, 다른 가족 구성원의 `avatar_color`/`avatar_text_color`/`avatar_image_url`이 화면에서 비어 보일 수 있음. 2026-07-07에 추가한 프로필 이미지 기능(가족 상태 카드, 끼니 참여자, 게시판 댓글 등에서 남의 사진 표시)이 이 문제 때문에 아예 동작하지 않을 수 있음 — 브라우저에서 실제 확인 후, 문제라면 `users` SELECT 정책을 워크스페이스 공유 멤버까지 허용하도록 수정 필요
- [ ] E 드라이브가 FAT32라서 `next build`(프로덕션 빌드)가 실패함 — NTFS 드라이브(C: 등)로 프로젝트 이전 필요. `next dev`는 정상 동작
- [ ] 장소 검색: 카카오 로컬 API 키가 없어 텍스트 직접 입력만 지원 (`PlaceInput.tsx`에 교체 지점 TODO 주석)
- [ ] 공휴일: 실제 공공데이터포털 API 대신 2026년 정적 목록만 지원 (`holidays.ts`)
- [ ] 습관/할 일: 등록 화면만 있고 목록/트래커 화면 없음
- [ ] 설정 탭 알림(push) 설정 미구현 (알림 페이지 `/notifications`와는 별개)
- [ ] AI Agent 버튼 기능 미연결 (플레이스홀더)
- [ ] Vercel 배포 여부 미확인
- [ ] `supabase/add_diary_habit_todo_and_schedule_columns.sql`, `supabase/add_notice_comment_and_avatar_storage.sql`을 라이브 DB에 실행했는지 확인 필요 (실행 전에는 각각 다이어리/습관/할 일/일정 사진·알림, 게시판 댓글·프로필 이미지 업로드가 DB 에러를 냄)
- [ ] 홈 헤더에서 날짜를 시간과 같은 줄에 작게 유지하기로 판단(사용자가 명시적으로 날짜를 빼라고 하진 않았음) — 의도와 다르면 조정 필요

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
  3. `supabase/add_notice_comment_and_avatar_storage.sql`
- `next build`는 FAT32 드라이브 이슈로 실패할 수 있음 — 변경 검증은 `next dev` + 브라우저/curl 확인으로 진행

---

### 유지 규칙
- 새 기능을 추가하거나 버그를 고칠 때마다 "진행 현황", "Supabase 스키마 현황", "알려진 이슈 / TODO" 를 그 자리에서 갱신한다.
- 값(API 키, 토큰 등)은 절대 이 파일에 기록하지 않는다 — 키 이름만.
