# 개발 참조 문서

## 마지막 업데이트: 2026-07-09 (홈 상단/섹션 조정 + 내 루틴 화면 전면 재설계)

- 2026-07-09: 홈 화면 상단 히어로/섹션 조정 — 시간 표시 "PM 10:45" 순서로 변경, 날씨 설명+지역명을 오른쪽 날짜와 같은 스타일 한 줄로 통합, 상단 상태 영역을 "나 혼자"에서 "가족 전체(나 포함) 가로 스크롤 목록"으로 교체하고 본문의 "지금 우리 가족은" 섹션은 제거(중복이라 상단으로 흡수). "오늘 뭐먹지"+"오늘 뭐하지"를 좌우 2단으로 묶고(기존엔 뭐하지+가족이었음), 각 섹션 라벨 줄 오른쪽 끝에 +버튼을 달아 끼니/일정/스티커/장바구니를 바텀시트로 바로 추가 가능(아래 "홈 탭" 섹션 참고)
- 2026-07-09: 내 루틴 화면(`/schedule/routine`) 전면 재설계 — 카드/블록 제거하고 홈과 동일한 헤어라인 기반으로 전환, 24시간 도넛형 차트 신규 도입(상태별 파스텔 컬러, 현재 시각 바늘, 자정 넘김 블록 지원), 요일 다중 선택(블록 추가 시 선택된 모든 요일에 동시 적용)+좌우 스와이프 요일 이동으로 재설계, 학기 버튼 UI 제거(컬럼은 유지, 항상 'default' 저장), "다른 요일에 복사" 섹션은 다중 선택으로 대체되어 제거 (아래 "내 루틴" 섹션 참고)
- 2026-07-08: 일정 탭을 홈과 같은 "스마트미러" 원칙으로 전환(카드/배경 박스 제거) — 월간/주간/연간 탭은 pill 배경 대신 텍스트+하단 언더라인, 필터 칩은 배경 없이 색상/`--text-muted` 텍스트만, 달력은 오늘 날짜만 honey 원형로 표시(선택한 날짜는 옅은 링으로 구분), 하단 일정 리스트는 홈 "오늘 뭐하지"와 동일한 `[시간(honey)] [제목(말줄임)] [대상]` 행 스타일로 통일. `SectionLabel`+`--section-indent`도 동일 적용 (아래 "일정 탭" 섹션 참고)
- 2026-07-08: 게시판 탭을 좌우 2단(6:4)에서 세로 스택(① 스티커 → ② 메모·공지 → ③ 장바구니)으로 재배치. 각 섹션 헤어라인 구분 + `SectionLabel`+들여쓰기, 메모·공지/장바구니는 3개 초과 시 "더보기"(게시판이 최종 목적지라 홈과 달리 링크 이동이 아니라 그 자리에서 펼침) (아래 "게시판 탭" 섹션 참고)
- 2026-07-08: 플로팅 에이전트 버튼을 모든 탭 노출에서 **일정 탭 전용**으로 변경, 기존 "+" 버튼 바로 위에 세로 배치. 스타일도 불투명 honey 원형 → "반투명 유리" 느낌(`bg-honey/10` + `backdrop-blur` + `border-honey/30`, 아이콘만 honey 원색), 크기도 52px→44px로 축소 (아래 "일정 파싱 에이전트" 섹션 참고)
- 2026-07-08: 앱 전체 `<input>`/`<textarea>` 다크 모드 버그 수정 — `--input-bg`/`--input-text`/`--input-placeholder`/`--input-border` 변수 쌍 신설 + 공용 `components/ui/Input.tsx`(`Input`/`Textarea`)로 통일. 체크박스/라디오도 전역 `accent-color`/`color-scheme` 적용 (아래 "입력 필드 테마" 섹션 참고, 상세 원인은 `DEBUG_LOG.md`).
- 2026-07-08: 홈 화면 히어로(상단 시간/날씨) 영역을 구글 스마트 디스플레이 스타일로 재배치 — 왼쪽 날씨(온도+아이콘+상태+지역명), 오른쪽 시간(오른쪽 정렬)의 좌우 대칭 2단 구성. 상단바 상태와 "지금 우리 가족은"에서 일정 병기를 제거해 "오늘 뭐하지" 섹션과의 중복을 없앴고, "오늘 뭐하지"의 [오늘]/[이번 주] 탭 토글도 제거(오늘 일정만, 최대 3개 + 더보기). 섹션 라벨 아이콘과 내용 시작점을 맞추는 `--section-indent` 토큰을 신설해 5개 홈 섹션에 공통 적용. 텍스트 말줄임(`truncate`)이 실제로 동작하지 않던 곳(부모가 flex인데 `min-w-0` 누락)도 홈/일정 탭 전반에서 함께 고침 (아래 "홈 탭" 섹션 참고).
- 2026-07-08: 사진/텍스트로 일정을 등록하는 플로팅 에이전트 대화창 추가. Next.js 앱과 분리된 Python 에이전트 서버(`agent/`, FastAPI + LangGraph + Gemini 2.5 Flash)가 파싱만 담당하고, 실제 저장은 사용자가 확인 카드에서 [등록]을 눌러야 기존 `createSchedule` 서버 액션으로 수행됨 (아래 "일정 파싱 에이전트" 섹션 참고).
- 2026-07-08: 홈 화면 3개 섹션(끼니/오늘+가족/게시판)을 위젯처럼 길게 눌러 순서를 바꿀 수 있는 기능 추가 (아래 "홈 탭" 섹션 참고, `@dnd-kit` 사용). `users.home_layout` JSONB 컬럼에 순서 저장.
- 2026-07-08: 로그인 화면을 이메일/비번/[로그인 상태 유지 체크박스]/기본 버튼/모드 전환 링크/소셜 원형 아이콘 순서로 재구성하고, 같은 화면에서 로그인⇄회원가입 모드를 전환하도록 변경 (아래 "인증" 섹션 참고). 다크 모드에서 안 보이던 버튼 글자 버그(`--btn-surface-bg`/`--btn-surface-text` 추가)도 함께 수정 — 상세는 `DEBUG_LOG.md` 참고.
- 2026-07-08: `PRD_fridge` § 10 디자인 가이드와 `README.md`의 디자인 섹션을 이전 "크림 배경 + 카드 + 0.5px 테두리" 체계에서 새 "스마트홈 미러 디스플레이"(블록 없음, CSS 변수 테마, 다크 모드 기본) 체계로 전면 교체함.

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
- ✅ 2026-07-07 `joinWorkspace` 보강: 정원(`member_limit`) 초과 시 에러, 이미 가입된 사용자는 재가입 대신 `/home`으로 리다이렉트, DB에도 `workspace_member(workspace_id, user_id)` UNIQUE 제약 추가 (동시 요청 레이스 컨디션 대비)
- ✅ 2026-07-08 로그인 화면 재구성 — 이메일 → 비밀번호 → (회원가입 모드면 비밀번호 확인) → (로그인 모드면 "로그인 상태 유지" 체크박스) → 기본 버튼(로그인/가입하기) → 모드 전환 링크("회원가입"/"로그인", 밑줄 텍스트일 뿐 버튼 아님) → (로그인 모드에서만) 헤어라인+"또는"+카카오/구글 원형 아이콘 버튼. `mode` state로 로그인/회원가입을 같은 화면에서 전환하며 `completeEmailAuth` 흐름은 그대로 재사용. 로고는 이모지 대신 `@tabler/icons-react`의 `IconFridge` 사용. 소셜 버튼은 아직 실제 OAuth 연동 전이라 탭하면 "준비 중이에요" 토스트만 표시(`ToastProvider`를 로그인 페이지에서도 쓸 수 있도록 루트 `layout.tsx`로 이동)
- ✅ 2026-07-08 자동 로그인("로그인 상태 유지") — 체크(기본값) 시 기존과 동일하게 Supabase 세션이 브라우저 종료 후에도 유지됨. 체크 해제 시 `src/lib/supabase/client.ts`의 `createClient({ persistSession: false })`가 `@supabase/ssr`의 쿠키 관리를 완전히 우회하고 `document.cookie`에 만료 시각 없는 **브라우저 세션 쿠키**를 직접 써서, 브라우저를 완전히 종료하면 로그아웃되도록 함(`@supabase/ssr` 0.12.0은 `cookieOptions.maxAge`를 넘겨도 내부적으로 항상 400일로 덮어써서 커스텀 쿠키 어댑터가 유일한 방법이었음 — `DEBUG_LOG.md` 참고). 체크박스 상태 자체는 `localStorage("fridge_keep_login")`에 저장해 다음 방문 시 복원

**서버 액션 보안/안정성 보강** — 2026-07-07 코드리뷰 반영
- ✅ `updateMeal`/`deleteSchedule`/`deleteNotice`에 로그인+작성자(`author_id`/`created_by`) 검증 추가 (이전엔 워크스페이스 멤버면 누구나 남의 끼니/일정/공지를 수정·삭제 가능했음). RLS도 이 3개 테이블의 UPDATE/DELETE를 작성자 전용 정책으로 분리 (`supabase/fix_author_policies.sql`)
- ✅ 뮤테이션을 수행하는 서버 액션 전반에 걸쳐 `if (error) throw new Error(...)` 누락 지점을 모두 채움 (기존엔 DB 작업이 실패해도 화면은 성공한 것처럼 넘어갔음) — 자세한 파일 목록은 `DEBUG_LOG.md` 참고
- ✅ 외부 공유 링크를 `share_token`으로 전환 (아래 "설정 탭" 참고)
- ✅ `joinWorkspace`에 정원 제한·중복 가입 방지 추가 (아래 "인증" 참고)

**다크/라이트 테마 시스템** — 2026-07-07 신규, 2026-07-08 앱 전체로 확장
- ✅ CSS 변수 기반(`--bg-page`, `--bg-surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--hairline`, 공통 `--accent-honey`/`--accent-sage`), `globals.css`에 라이트(기본) + `@media (prefers-color-scheme: dark)` + `[data-theme="light"|"dark"]` 명시적 오버라이드로 정의
- ✅ `ThemeProvider`(`src/components/ui/ThemeProvider.tsx`) — `localStorage`(`fridge-theme` 키)에 저장, 선택하지 않으면 시스템 설정을 그대로 따름. 값은 DB가 아니라 브라우저 로컬 저장소에만 있음 (기기별로 따로 적용됨 — 여러 기기 동기화가 필요해지면 `users` 테이블 컬럼으로 옮겨야 함)
- ✅ 루트 레이아웃에 하이드레이션 전 깜빡임 방지용 인라인 스크립트 추가
- ✅ 설정 탭에 "화면 모드" 라이트/다크/시스템 설정 토글 (`ThemeToggle`)
- ✅ 2026-07-08: **앱 전체(식탁/일정/게시판/설정 포함)에 다크 모드 적용**. `tailwind.config.ts`의 `cream`/`ink`/`stone`/`border-light` 색상 토큰을 고정 hex에서 CSS 변수 참조로 바꾸고, 카드 배경으로 쓰이던 `bg-white`를 새 `bg-surface`(`--bg-surface`) 토큰으로 교체 — 이미 앱 전체에 쓰이던 클래스라 컴포넌트 코드를 거의 안 건드리고 전체가 테마에 반응하게 됨. 로그인/공유(`/share`)/워크스페이스 생성 페이지는 의도적으로 라이트 고정 유지
- ⚠️ 처음 구현했을 때 다크 모드가 "전혀 안 먹히는" 버그가 있었음 — 원인과 해결은 `DEBUG_LOG.md` 2026-07-08 항목 참고 (`tailwind.config.ts`의 `content` 글롭에 `src/lib`가 빠져서 `mirror.*` 클래스 자체가 생성되지 않고 있었음)
- ✅ 2026-07-08 `--btn-surface-bg`/`--btn-surface-text` 변수 쌍 추가 — 배경을 하드코딩(`bg-white` 등)하면서 텍스트만 테마 변수를 쓰던 버튼들이 다크 모드에서 안 보이던 버그 수정용. 배경색을 고정값으로 쓸 거면 텍스트도 반드시 짝이 되는 고정/변수 쌍으로 맞출 것 (상세는 `DEBUG_LOG.md` 참고)
- ✅ 2026-07-08 `--input-bg`/`--input-text`/`--input-placeholder`/`--input-border` 변수 쌍 추가 + 공용 `src/components/ui/Input.tsx`(`Input`/`Textarea`) — `<input>`/`<textarea>`는 배경 지정이 없으면 브라우저가 항상 흰색으로 렌더링해서, 배경/텍스트 클래스를 따로 안 챙긴 입력창들이 다크 모드에서 전부 흰 배경에 흰 글씨가 되던 버그를 앱 전체에서 수정 (상세는 `DEBUG_LOG.md` 참고). `Input`/`Textarea`는 색상만 강제하고 크기(h-*/rounded-*/px-*/text-*)는 호출부 `className`에서 지정 — Tailwind가 같은 카테고리 유틸리티 충돌 시 JSX 순서가 아니라 내부 생성 순서로 승패를 가르는 걸 피하기 위함. 체크박스/라디오는 전역 `accent-color: var(--accent-honey)` + `border` + `color-scheme: light dark`로 통일(개별 컴포넌트 수정 없이 `globals.css` 전역 규칙 하나로 앱 전체 적용)
- 새 입력 필드를 만들 때는 항상 `Input`/`Textarea`를 쓸 것 — 배경 없는 raw `<input>`/`<textarea>`를 다시 추가하면 같은 버그가 재발함

**홈 탭** — 2026-07-07 "스마트미러" 스타일로 전면 재구성 (카드/배경 박스 전부 제거, 타이포그래피+헤어라인+여백만으로 구획)
- ✅ 상단 헤더 — 최상단 우측에 🔔알림(`/notifications`)·⚙️설정(`/settings`) 아이콘(배경 없음). 히어로 영역은 구글 스마트 디스플레이 스타일 좌우 대칭: **왼쪽**(온도 40px + 날씨 이모지, 그 아래 "날씨 설명 · 지역명" 한 줄 — 2026-07-09부터 오른쪽 날짜 텍스트와 동일한 12px/`--text-secondary`로 통일, 이전엔 날씨 15px/지역명 10px로 서로 달랐음) / **오른쪽**(2026-07-09: `AM/PM`을 시간 **앞**에 작게 배치 — "10:45 PM" → "PM 10:45", 시간 자체 56px 얇은 웨이트는 그대로, 그 아래 날짜·요일 한 줄 12px, 오른쪽 정렬)
  - ✅ 2026-07-09: 히어로 아래 상태 영역을 "본인 1명"에서 **가족 전체(나 포함) 가로 스크롤 목록**으로 교체 — `[아바타+이름 상태]`를 멤버 수만큼 가로로 나열, 넘치면 스크롤. 본문에 따로 있던 "지금 우리 가족은" 섹션은 이걸로 흡수되어 **제거**됨 (`FamilyStatusCard.tsx` 삭제, `HomeHeader`가 `FamilyMemberStatus[]` 전체를 직접 받음)
  - 상태 텍스트는 **루틴 기반 상태만** 표시(예: "쉬는 중", "업무 중") — 오늘 일정 병기는 "오늘 뭐하지" 섹션이 전담(`home/page.tsx`의 `familyStatus` 계산에 일정 병합 로직 없음)
- ✅ 오늘 뭐먹지 + 오늘 뭐하지 — 2026-07-09부터 **좌우 2단으로 통합**(기존엔 "오늘 뭐하지 + 지금 우리 가족은"이 2단이었음). 메뉴명 폰트도 22→17px로 축소(2단이 되며 폭이 좁아진 데 맞춤)
  - 오늘 뭐먹지: 가로 스와이프 캐러셀(스크롤바 숨김, `.scrollbar-hide`), 오늘 등록된 끼니 전부 시간순 정렬 + "태그·타입" 보조줄 + "+ 사이드·참여자 이름" 보조줄. 점 인디케이터는 활성 시 honey 색 길쭉한 필
  - 오늘 뭐하지: 각 행 순서가 2026-07-09부터 `[제목(말줄임)] [시간/종일 배지(honey, tabular-nums, bg-honey/10 pill)] [대상(옅게)]`로 변경(이전엔 시간이 맨 앞이었음). 오늘 일정만 최대 3개 표시하고 초과 시 "더보기"(`/schedule`로 이동)
- ✅ 2026-07-09 섹션별 빠른 추가 — "오늘 뭐먹지"/"오늘 뭐하지"/"스티커"/"장바구니" 라벨 줄 오른쪽 끝에 44px 탭 영역의 `+` 아이콘(배경/테두리 없음, `--text-muted`) 배치, 탭하면 바텀시트가 바로 열려 추가 가능(전용 페이지 이동 없음):
  - 끼니: 신규 `MealQuickAddSheet.tsx`(태그/유형/메뉴/사이드/메모, `createMeal` 재사용) — 홈 전용 경량 버전, 재고 확인 등 `AddMealScreen`의 부가 기능은 뺌
  - 일정: 기존 `AddEventSheet.tsx`(일정 탭과 동일 컴포넌트) 그대로 재사용
  - 스티커: `BoardSection.tsx`의 `AddPostSheet`를 export해 재사용 — `fixedType="sticky"` prop을 주면 타입 선택 UI 자체를 숨기고 스티커 고정
  - 장바구니: 신규 `ShoppingQuickAddSheet.tsx`(입력 한 줄 + 추가, `addShoppingItem` 재사용)
  - 이 4개 + 버튼을 지원하려고 `SectionLabel`에 옵션 prop `onAdd`/`addLabel` 추가(지정 안 하면 기존처럼 라벨만 표시, 하위 호환) — `BoardPreview.tsx`는 이제 전체를 감싸던 `<Link href="/board">` 대신 각 칼럼의 콘텐츠 목록만 개별 `Link`로 감싸는 구조로 변경(버튼을 `<a>` 안에 중첩하면 안 되므로)
- ✅ 게시판 미리보기 — 좌우 2열(블록 없음): 왼쪽 스티커(작성자+내용+D-N, 전부 흐림/작게), 오른쪽 장바구니(3px sage 도트+이름, 4개+"외 N개"). 콘텐츠 목록은 `/board`로 링크
- ✅ 태블릿(lg: 1024px~) 3단 컬럼 — `grid-cols-mirror`(1fr 1.4fr 1fr) 토큰, 좌: 헤더 정보(세로 중앙) / 중: 끼니+오늘 2단 통합 / 우: 게시판 미리보기, 컬럼 사이 헤어라인. 모바일은 그대로 세로 스택
- ✅ 여백/색상 전부 토큰화: `tailwind.config.ts`의 `spacing.section`(30px)/`label-gap`(12px)/`row`(7px), `src/lib/homeTheme.ts`의 `mirror.*` (CSS 변수 참조 클래스 모음) — 하드코딩 없음
- ✅ 섹션 라벨(오늘 뭐먹지/오늘 뭐하지/스티커/장바구니) 앞에 14px 픽토그램 아이콘 (`SectionLabel` 공용 컴포넌트, `mirror.label` 색 그대로 상속)
- ✅ 섹션 내용 들여쓰기 — 라벨의 [아이콘 14px + gap-1.5(6px)]과 내용 시작점을 맞추기 위해 `--section-indent`(20px) 토큰, `pl-section-indent`로 홈 섹션 콘텐츠 래퍼에 공통 적용
- ✅ 텍스트 말줄임(ellipsis) 버그 수정 — flex 행 안의 `truncate` span이 `min-w-0` 없이 `flex-1`(혹은 아무 크기 지정도 없이)만 있으면 브라우저 기본값(`min-width: auto`)때문에 실제로는 잘리지 않고 밀려나가는 문제가 있었음. 홈/일정 탭 리스트 전반에 `min-w-0 flex-1` 조합을 일괄 적용 (`DEBUG_LOG.md` 참고)
- ✅ 홈 섹션 순서 커스터마이징(모바일 전용, 태블릿 3단 쇼케이스는 대상 아님) — 2026-07-09부터 드래그 가능한 위젯이 **3개→2개**로 축소: ① `meal`(오늘 뭐먹지+오늘 뭐하지 2단 통합, "지금 우리 가족은"이 상단으로 흡수되며 "today" 위젯은 없어짐), ② `board`(게시판 미리보기). 섹션을 500ms 길게 누르면 편집 모드 진입(전체 섹션 `scale-0.97` + 각 섹션 왼쪽에 `IconGripVertical` 핸들 노출), 핸들을 드래그하면 `@dnd-kit/core`+`@dnd-kit/sortable`로 순서 변경. 편집 모드 종료는 빈 곳 탭 또는 상단 "완료" 버튼. 순서는 낙관적으로 즉시 반영되고, 서버 액션(`updateHomeLayout`, `home/actions.ts`)으로 `users.home_layout`(JSONB 배열, 예: `["meal","board"]`)에 저장 — 저장 실패해도 화면 순서는 그대로 유지하고 토스트만 띄움. 페이지 로드 시 `resolveHomeLayout()`(`src/lib/homeLayout.ts`)이 저장값에서 알려진 섹션 id만 남기고, 새로 추가될 미래 섹션은 자동으로 뒤에 이어 붙임(값이 없으면 기본 순서 `meal→board`). `HomeSectionId` 타입에서 `"today"`가 제거됐으므로 기존에 저장된 `"today"` 항목은 자동으로 걸러지고 무시됨(마이그레이션 불필요). 컴포넌트: `src/components/home/HomeSections.tsx`
  - `supabase/add_home_layout.sql`(`users.home_layout JSONB` 컬럼 추가)을 라이브 DB의 SQL Editor에서 실행해야 순서 저장이 동작함 (미실행 상태면 조회는 되지만 항상 기본 순서만 나오고, 저장 시도 시 컬럼 없음 에러가 날 수 있음)

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
- ✅ 루틴 설정 — 2026-07-09 전면 재설계, 아래 "내 루틴" 섹션 참고
- ✅ 다이어리 / 습관 / 할 일 템플릿 — 2026-07-07 신규, PRD 범위 밖 추가 기능. `+` 버튼이 4종 템플릿 선택 화면을 먼저 보여주도록 개편
  - ⚠️ 습관·할 일은 **등록 화면만 구현**, 목록/트래커 표시 화면은 없음
- ✅ 공휴일 표시 — 2026-07-07 신규, 정적 2026년 목록만 지원 (실시간 API 아님)
- ✅ 2026-07-08: 일정 탭 전용 AI 버튼(플레이스홀더, `AiAssistButton`)은 삭제하고 일정 탭 전용 플로팅 에이전트(`AgentLauncher`)로 대체됨 — 아래 "일정 파싱 에이전트" 섹션 참고
- ✅ 2026-07-08 홈과 동일한 "스마트미러" 원칙으로 전환(카드/배경 박스 제거):
  - 월간/주간/연간 뷰 전환 — pill 배경 대신 텍스트 탭 + 하단 2px 언더라인(활성: `--text-primary`, 비활성: `--text-muted`)
  - 필터 영역(`EventFilters`/`TagChip`) — 배경 박스·pill 전부 제거, 칩은 배경 없이 텍스트+색상만(활성 키워드는 해당 키워드 색, 비활성은 `--text-muted`)
  - 달력(`MonthView`) — 카드 배경 제거, **오늘 날짜만** honey 원형(`bg-honey/15`)으로 항상 표시, 클릭해서 고른 날짜는 옅은 링(`ring-honey/40`)으로 구분(둘은 서로 다른 날짜일 수 있음 — 이전엔 "선택한 날짜"만 표시하고 "오늘"은 별도 표시가 없었음)
  - 하단 일정 리스트(월/주/연간 공통) — 카드 제거, 홈 "오늘 뭐하지"와 동일한 `[시간(honey, tabular-nums)] [제목(말줄임)] [대상(옅게)]` 행 스타일로 통일. `targetLabel()`/`MemberInfo`를 `src/lib/scheduleTargets.ts`로 공용 추출(기존엔 `TodayEvents.tsx`에만 있었음)해 `MonthView`/`WeekView`/`YearView`가 함께 재사용 — 이 뷰들엔 원래 "대상" 표시 자체가 없었는데 이번에 새로 추가됨
  - `SectionLabel`+`--section-indent` 동일 적용 (아이콘 14px + 라벨 + 내용 들여쓰기), 섹션 사이는 헤어라인만

**내 루틴** (`/schedule/routine`, `RoutineEditor.tsx`) — 2026-07-09 전면 재설계 (카드/블록 제거, 홈과 동일한 헤어라인 기반)
- ✅ 24시간 도넛형 차트(`RoutineWheel.tsx`, 신규) 신규 도입 — 화면 상단에 보기 전용 SVG 시각화. 자정이 12시 방향, 시계 방향으로 24시간. 등록된 시간 블록을 상태별 파스텔 색 아크로 표시, 중앙에 현재 시각(`HH:MM`) + 현재 시각 방향을 가리키는 바늘(honey), 0/6/12/18시 위치에 작은 눈금. 아크를 탭하면 해당 블록이 확대·강조되고 아래 리스트에서도 같은 블록이 강조됨(리스트 행을 탭해도 동일하게 동작) — 차트 자체는 드래그로 편집하지 않음(값은 아래 폼으로만 변경)
  - 자정을 넘기는 블록(예: 21:30~07:30 취침)도 지원 — 종료 시각이 시작 시각보다 이르면 24시를 더해 하나의 연속 아크로 그림(SVG `A` 커맨드의 large-arc-flag를 실제 경과각도 기준으로 계산해서 자정을 가로질러도 정확히 그려짐)
  - 상태별 색상은 `src/lib/routineColors.ts`(`STATUS_COLOR_VAR`)가 `globals.css`의 `--routine-work`/`-class`/`-exercise`/`-study`/`-rest`/`-sleep`/`-commute`/`-custom` 8개 변수(라이트=파스텔, 다크=톤 다운된 파스텔)로 매핑 — 블록 추가 폼의 상태 칩도 선택 시 같은 색을 배경으로 써서 차트와 일관되게 연결
- ✅ 요일 다중 선택으로 재설계 — 상단 요일 칩(월~일)은 유지하되 이제 **중복 선택 가능**(탭할 때마다 토글, 최소 1개는 항상 선택 상태 유지). 선택 순서를 배열로 추적해 **마지막으로 선택한 요일**을 차트/블록 리스트가 보여주는 "기준 요일"로 삼음(먼저 선택해 둔 다른 요일은 진하기가 옅은 강조로만 구분)
  - "블록 추가" 시 현재 선택된 **모든** 요일에 동시 적용(각 요일의 로컬 상태에 같은 블록을 추가) — 기존에 있던 "다른 요일에 복사" 섹션은 이 다중 선택으로 완전히 대체되어 **제거**됨
  - 좌우 스와이프(`onTouchStart`/`onTouchEnd`, 40px 임계값)로 기준 요일을 월→화→...→일→월 순으로 이동 — 스와이프는 항상 해당 요일 **단일 선택**으로 초기화됨(다중 선택은 칩을 직접 탭할 때만 유지/누적)
- ✅ 학기(기본/여름학기/겨울학기) 버튼 UI 제거 — `routine.semester` 컬럼 자체는 그대로 두고, 코드에서 항상 `'default'`로 고정 저장(`SEMESTER` 상수). 예전에 여름/겨울학기로 저장된 데이터가 있다면 이 화면에서는 더 이상 보이지 않음(의도된 단순화)
- 저장 로직 자체(요일별 `blocks` JSONB, `upsertRoutine` 서버 액션)는 기존과 동일 — "저장하기" 버튼을 눌러야 반영되며, 다중 선택된 요일이면 선택된 요일 수만큼 `upsertRoutine`을 반복 호출

**일정 파싱 에이전트** (`agent/`, 플로팅 대화창) — 2026-07-08 신규, 같은 날 오후 **일정 탭 전용으로 범위 축소**
- ✅ 2026-07-08: 노출 범위를 모든 탭 → **일정 탭에서만** 노출로 변경(`(main)/layout.tsx`가 아니라 `schedule/page.tsx`에서 직접 렌더). 위치도 기존 "+" 버튼(`bottom-[84px]`) 바로 위(`bottom-[148px]`, 이전 `AiAssistButton` 플레이스홀더가 있던 자리 그대로 재사용)로 세로 배치
- ✅ 2026-07-08: 스타일을 불투명 honey 원형 → "반투명 유리" 느낌으로 변경 — `bg-honey/10` + `backdrop-blur-md` + `border-honey/30`(1px), 아이콘은 honey 원색 유지. 크기도 52px → 44px(`AGENT_BUTTON_SIZE`, `+` 버튼 56px보다 살짝 작게)로 축소
- ✅ 버튼이 받는 멤버 목록 타입을 `WorkspaceMemberInfo`(아바타 필드 포함) → `AgentMemberOption`(`user_id`/`display_name`만, `src/lib/agentApi.ts`)으로 축소 — `ConfirmCards`/`AgentSheet`가 실제로 쓰는 필드만 남겨서, 스케줄 탭처럼 아바타 정보가 없는 멤버 목록도 그대로 넘길 수 있게 함
- ✅ 탭하면 화면 78% 높이 바텀시트 대화창(`AgentSheet`)이 슬라이드업 (동작 자체는 변경 없음). 핸들바를 위로 드래그하면 풀스크린, 아래로 드래그하거나 X를 누르면 닫힘
- ✅ 입력: 텍스트 직접 입력 또는 이미지 첨부(카메라 촬영/갤러리, `<input type=file accept=image/*>` 하나로 둘 다 선택 가능) → base64로 변환해 에이전트 서버에 전송. 마이크 버튼은 자리만 있고 비활성(P0-B 음성 입력 자리)
- ✅ 에이전트 서버(`agent/`)는 Next.js 앱과 완전히 분리된 Python FastAPI 서비스: LangGraph로 Plan(입력 종류 판별) → Execute(Gemini 2.5 Flash로 일정 정보 추출) → 단일 일정이면 Refine(날짜가 없으면 `interrupt`로 멈추고 되물음) → ReturnSingle, 여러 일정(이미지 속 표·목록)이면 PrepareMulti로 분기. **파일/DB에 아무것도 저장하지 않음** — 파싱 결과만 반환
- ✅ 응답 스키마는 Fridge `schedule` 테이블과 동일한 필드(`title/date_start/date_end/time_start/time_end/supplies/memo/keyword_main/keyword_sub/is_important/target_hint`). 여러 일정이면 `{status:"ok", schedules:[...]}`, 날짜 등 정보가 부족하면 `{status:"need_input", message, thread_id}`를 반환 — 클라이언트는 같은 `thread_id`와 사용자의 텍스트 답변(`user_reply`)으로 다시 요청해 재개(resume)함. 이미지 첨부는 항상 새 요청으로 취급(재개 대상 아님)
- ✅ 확인 카드(`ConfirmCards`) — 채팅 흐름 안에 가로 스와이프 카드로 인라인 렌더. 카드마다 키워드 태그, 순번(n/N), 제목(인라인 수정), 날짜/시간/준비물/메모, `target_hint`로 미리 선택된 가족 구성원 칩(최종 선택은 사용자가 조정), [건너뛰기]/[등록] 버튼. [등록]을 눌러야 기존 `createSchedule` 서버 액션이 호출되어 실제 DB에 저장됨(RLS 그대로 유지) — `supplies`는 DB 저장 시 기존 관례대로 `memo`에 합쳐짐. 전부 처리되면 "N개 등록 · M개 건너뜀" 요약 말풍선 표시
- ✅ 에러 처리: 서버 미응답/네트워크 오류 시 "잠시 후 다시 시도해주세요" 말풍선 + `/schedule`로 이동하는 수동 등록 유도 링크
- ⚠️ 아직 음성 입력, 일정 외 탭(식탁/장바구니/게시판)으로의 라우팅은 미구현 (PRD_fridge § 6 참고)

**게시판 탭** (`/board`) — 독바에서 "설정"을 대체. 2026-07-08 좌우 2단(6:4) → **세로 스택**으로 재배치(위→아래: ① 스티커 ② 메모·공지 ③ 장바구니), 홈과 동일하게 `SectionLabel`+`--section-indent`+헤어라인 구분 적용
- ✅ ① 스티커 — 가로 슬라이드(스크롤), 카드 안에 작성자(작게·옅게)+내용, D-N 배지는 카드 **밖** 오른쪽 아래. 댓글 없음. 개수 제한 없음(가로 스크롤로 전부 접근 가능하므로 "더보기" 대상 아님)
- ✅ ② 메모·공지 — 작성자·시간 헤더 + 내용 미리보기, 공지는 제목 앞 📌 표시(기존 `is_pinned` 상단고정과는 별개 개념). **3개 초과 시 하단에 "더보기"** — 게시판이 이미 최종 목적지라 홈 미리보기처럼 다른 라우트로 이동하는 링크가 아니라, 같은 자리에서 펼쳐지는 토글(`postsExpanded` 상태)
- ✅ 메모/공지 댓글 — 2026-07-07 신규 `notice_comment` 테이블 + `addNoticeComment` (`meal_comment`/`addMealComment` 패턴 그대로 미러링). 스티커는 댓글 없음
- ✅ ③ 장바구니 — `ShoppingList` 전체 관리(추가/체크/삭제), 2026-07-08부터 카드 배경 제거 + **3개 초과 시 "더보기"**(마찬가지로 그 자리에서 펼침) 적용. 이전의 `max-h-[70vh] overflow-y-auto` 독립 스크롤 영역은 세로 스택으로 바뀌면서 불필요해져 제거
- `addNotice`/`deleteNotice`/`addNoticeComment` 액션은 `home/actions.ts`에서 `board/actions.ts`로 이동함 (게시판이 독립 라우트가 됐으므로)
- 2026-07-08: `tailwind.config.ts`의 `grid-cols-board`(3fr 2fr) 토큰은 더 이상 쓰이는 곳이 없음(세로 스택으로 전환) — 향후 다시 2단 레이아웃이 필요해지면 재사용 가능하므로 설정 자체는 남겨둠

**알림** (`/notifications`) — 2026-07-07 신규, 헤더의 🔔 아이콘으로만 진입 (독바에 없음, `/settings`와 동일한 진입 방식)
- ✅ `notice` 테이블에서 `type = 'notice'`인 항목만 시간순으로 나열, 각 항목에 "게시판에서 보기" 링크. 댓글 등 상호작용은 게시판 탭에 집중, 여기선 읽기 전용 요약만

**설정 탭** (`/settings`) — 독바에서 빠지고, 홈 헤더의 ⚙️ 아이콘으로 진입 (라우트 자체는 그대로 존재)
- ✅ 프로필 이미지 업로드 (위 "프로필 이미지" 참고)
- ✅ 가족 구성원 관리 (리스트 뷰 — PRD의 "조직도 뷰"는 아님)
- ✅ 외부 공유 링크 — 2026-07-07 `workspace_id` 대신 별도 `share_token`(UUID) 기반으로 전환 (`/share/[token]`). 오너는 "링크 재발급" 버튼으로 기존 링크를 무효화하고 새 토큰을 발급 가능 (`ShareLinkSection`)
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
    workspace/             워크스페이스 생성/가입 (actions.ts, join/[workspaceId] — 초대 링크 자체는 workspace_id 그대로 사용, 공유 링크만 토큰화됨)
    share/[token]/         2026-07-07: [workspaceId]에서 개명, 비로그인 읽기 전용 공유 페이지. `family_workspace.share_token`으로 조회
  components/
    home/                  HomeHeader(2026-07-09: `FamilyMemberStatus[]` 전체를 직접 받아 가족 전체 상태 행 렌더 — `FamilyStatusCard.tsx`는 이 변경으로 완전히 미사용이 되어 삭제됨)/MealSummaryCard/TodayEvents — 전부 "스마트미러" 스타일(카드 제거, mirror.* 토큰 사용). SectionLabel(아이콘+라벨 한 줄 공용 컴포넌트, 2026-07-09: 옵션 `onAdd`/`addLabel`로 라벨 줄에 + 버튼 추가 가능), HomeSections(모바일 홈 섹션 드래그앤드롭 — `@dnd-kit` 기반), BoardPreview(홈 미리보기 2열, 2026-07-09: 스티커/장바구니 + 버튼과 시트 추가로 클라이언트 컴포넌트로 전환), ShoppingList(게시판 탭 전체 관리용), BoardSection(게시판 탭, `AddPostSheet`를 2026-07-09부터 export + `fixedType` prop 지원), HomeMealSection/HomeTodaySection(2026-07-09 신규: 섹션 라벨+콘텐츠+빠른 추가 시트를 묶는 래퍼), MealQuickAddSheet/ShoppingQuickAddSheet(2026-07-09 신규: 홈 전용 경량 추가 시트)
    food/                  MealCard, MealDetail, AddMealScreen, WeekCalendar
    schedule/              MonthView/WeekView/YearView, AddEventEntry(+picker+4개 Sheet), EventFilters, RoutineEditor(2026-07-09 전면 재설계 — 아래 "내 루틴" 참고), RoutineWheel(2026-07-09 신규: 24h 도넛 차트), PlaceInput (2026-07-08: 일정 탭 전용 AiAssistButton 플레이스홀더는 삭제됨 — agent/ 아래 참고)
    agent/                 2026-07-08 신규, 같은 날 오후 일정 탭 전용으로 범위 축소: AgentLauncher(플로팅 버튼), AgentSheet(바텀시트 대화창), ConfirmCards(확인 카드, 입력 소스 무관 재사용 가능하게 설계)
    settings/              AvatarUploader(프로필 이미지 업로드), ThemeToggle(화면 모드 전환), ShareLinkSection(2026-07-07 신규, 토큰 기반 공유 링크 + 재발급 버튼)
    ui/                    BottomSheet, Toast(+ToastProvider/useToast), ThemeProvider(useTheme 훅+localStorage 영속화), Avatar(imageUrl 지원), TagChip, CheckToggle, DockBar(2026-07-08: `bg-cream` 배경 복원 — 완전 투명이라 스크롤 시 콘텐츠와 겹쳐 보이는 문제가 있었음), CopyLinkButton, Input(2026-07-08 신규: `Input`/`Textarea` — 앱 전체 입력 필드 색상 통일용 공용 컴포넌트)
  lib/
    supabase/              client.ts(브라우저, avatar 업로드에도 사용) / server.ts(서버, 쿠키 기반) / admin.ts(서비스 롤, 공유 페이지 전용) / middleware.ts(세션 갱신)
    workspace.ts            requireWorkspaceContext() — 로그인+워크스페이스 멤버십 가드, {supabase,user,workspaceId,role,displayName} 반환
    members.ts               mapWorkspaceMembers() — workspace_member+users 조인 결과를 화면용 형태로 변환하는 공용 헬퍼
    uiTokens.ts               AVATAR_SIZE(mirror 18px 추가), SHOPPING_DOT_SIZE — 여러 컴포넌트가 공유하는 크기값
    homeTheme.ts              2026-07-07 신규: mirror.* — 홈 화면 전용 CSS 변수 참조 클래스 모음(bg/primary/secondary/muted/hairline/label). 다른 탭의 cream/ink/stone과는 별개 팔레트
    homeLayout.ts             2026-07-08 신규: HomeSectionId 타입 + resolveHomeLayout() — 저장된 홈 섹션 순서를 알려진 id만 남기고 미래에 추가될 섹션은 뒤에 이어붙이는 헬퍼
    date.ts                  날짜 포맷/이동 유틸 (toDateStr, formatYearMonth, addMonths, formatPostTimestamp, WEEKDAY_LABEL 등)
    weather.ts               OpenWeatherMap 서버 전용 fetch 헬퍼 (키 없거나 실패 시 null)
    holidays.ts               2026년 KR 공휴일 정적 목록 (실 API 교체 지점 TODO 주석 있음)
    scheduleKeywords.ts       일정/할 일 공용 태그+색상 그룹 (KEYWORD_GROUPS) — agent/agent.py의 KEYWORD_GROUPS와 동일하게 유지할 것
    scheduleTargets.ts        2026-07-08 신규: targetLabel()/MemberInfo — 일정의 target_members를 "가족"/이름/"가족 외 N"으로 표시하는 공용 헬퍼. TodayEvents(홈)와 MonthView/WeekView/YearView(일정 탭)가 함께 재사용
    agentApi.ts               2026-07-08 신규: callAgent() — NEXT_PUBLIC_AGENT_API_URL의 /process-schedule 호출, AgentSchedule/AgentResponse/AgentMemberOption 타입
    mealUtils.ts / routineUtils.ts   끼니/루틴 관련 계산 유틸 (2026-07-08: 태그별 가상 시각을 만들어 보여주던 `tagHourLabel`은 오해를 일으켜 제거 — 실제 시각 정보는 외식 `reservation_time`만 사용)
    routineColors.ts          2026-07-09 신규: STATUS_COLOR_VAR — 루틴 상태(업무/수업/운동/공부/휴식/취침/이동/커스텀) → globals.css의 --routine-* CSS 변수 이름 매핑
  types/index.ts            전체 테이블에 대응하는 TS 인터페이스 (NoticeComment, FamilyWorkspace.share_token 2026-07-07 추가)
src/app/globals.css                                       다크/라이트 테마 CSS 변수 (--bg-page, --bg-surface 등) + `.scrollbar-hide` 유틸리티(2026-07-08 추가, 캐러셀 스크롤바 숨김용)
src/app/layout.tsx                                        ThemeProvider 래핑 + 하이드레이션 전 테마 적용 인라인 스크립트
tailwind.config.ts                                        gridTemplateColumns.board="3fr 2fr"(게시판), .mirror="1fr 1.4fr 1fr"(홈 태블릿 3단), spacing.section/label-gap/row/section-indent(2026-07-08 추가, 홈 여백 리듬). **2026-07-08: `content` 글롭을 `./src/**/*.{js,ts,jsx,tsx,mdx}` 하나로 통합** — 예전엔 `src/lib`가 빠져 있어서 `mirror.*` 클래스가 실제로 생성되지 않는 버그가 있었음(`DEBUG_LOG.md` 참고). `cream`/`ink`/`stone`/`border-light`/`surface`/`input`/`input-text`/`input-placeholder`/`input-border`(2026-07-08 추가) 색상 토큰도 CSS 변수 참조
supabase/
  schema.sql                                              최초 전체 스키마 (참고용 — 라이브 DB에 직접 재실행하지 않음)
  fix_rls.sql / fix_rls_v2.sql                             family_workspace/workspace_member RLS 패치 (실행 완료)
  backfill_missing_user.sql                                누락된 users row 1건 수동 backfill (실행 완료)
  add_diary_habit_todo_and_schedule_columns.sql            diary/habit/todo 신규 테이블 + schedule 컬럼 추가 (실행 여부 확인 필요)
  add_notice_comment_and_avatar_storage.sql                notice_comment 테이블 + users.avatar_image_url + avatars Storage 버킷/정책 (실행 여부 확인 필요)
  fix_author_policies.sql                                  2026-07-07 신규: meal/schedule/notice의 UPDATE/DELETE를 작성자 전용 정책으로 분리 (실행 필요)
  add_share_token.sql                                       2026-07-07 신규: family_workspace.share_token 컬럼 추가 (실행 필요)
  add_workspace_member_unique.sql                           2026-07-07 신규: workspace_member(workspace_id, user_id) UNIQUE 제약 (실행 필요)
  add_home_layout.sql                                        2026-07-08 신규: users.home_layout JSONB 컬럼 추가 (홈 섹션 순서 저장용, 실행 필요)
middleware.ts                                              프로젝트 루트, 모든 요청에 대해 세션 갱신 (updateSession 위임)
agent/                                                     2026-07-08 신규: Next.js와 분리된 Python 에이전트 서버 (별도 실행/배포 대상, 아래 "일정 파싱 에이전트 로컬 실행" 참고)
  main.py                                                  FastAPI 진입점 — POST /process-schedule, GET /health
  agent.py                                                 LangGraph 그래프 (plan/execute/refine/return_single/prepare_multi 노드), Gemini 2.5 Flash 호출, 날짜/시간 정규화 헬퍼
  requirements.txt                                          langgraph, langchain-google-genai, fastapi, uvicorn 등
  .env.example                                              GEMINI_API_KEY, ALLOWED_ORIGINS
```

## 환경변수

`.env.local`(Next.js)에 필요한 키 (값은 기록하지 않음):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENWEATHER_API_KEY` — 2026-07-07 추가, 홈/일정 탭 날씨 표시용
- `NEXT_PUBLIC_AGENT_API_URL` — 2026-07-08 추가, 일정 파싱 에이전트 서버 주소 (로컬 기본값 `http://localhost:8000`)

`agent/.env`(Python 에이전트 서버, `agent/.env.example` 참고)에 필요한 키:
- `GEMINI_API_KEY` — Google AI Studio에서 발급
- `ALLOWED_ORIGINS` — CORS 허용 도메인, 콤마 구분 (로컬 기본값 `http://localhost:3000`, 배포 후 실제 Vercel 도메인 추가 필요)

## Supabase 스키마 현황

**테이블 (18개)**: `family_workspace, users, workspace_member, routine, schedule, meal, meal_participation, meal_like, meal_comment, fridge_item, shopping_item, notice, notice_comment, expense, diary, habit, todo`

**헬퍼 함수**: `is_workspace_member(workspace_id)` (SECURITY DEFINER, workspace_member 자기 참조 재귀 회피용), `get_workspace_name(workspace_id)` (비멤버도 초대 링크 미리보기에서 워크스페이스 이름 확인 가능)

**Storage**: `avatars` 버킷(퍼블릭) — 2026-07-07 신규. 경로 규칙 `avatars/{user_id}/{filename}`, 읽기는 공개, 쓰기(INSERT/UPDATE)는 `auth.uid() = 첫 폴더명`인 경우만 허용

**RLS 정책 요약**
- `family_workspace`: INSERT(로그인 유저 누구나) / SELECT·UPDATE(`is_workspace_member`)
- `users`: INSERT·SELECT·UPDATE 모두 `auth.uid() = id` — **본인 row만 조회 가능**. workspace_member와 join해서 다른 가족 구성원의 `avatar_color`/`avatar_text_color`/`avatar_image_url`를 가져오는 여러 화면(홈, 설정, 일정, 식탁, 게시판)에서 RLS 때문에 다른 사용자 필드가 비어 보일 가능성 있음 — **2026-07-07 기준 아직 미확인이며, 이번에 추가한 프로필 이미지 기능이 통째로 안 보일 수도 있는 원인** (아래 TODO 최우선 항목 참고)
- `workspace_member`: SELECT(같은 워크스페이스 멤버끼리), INSERT/DELETE(본인 행만). 2026-07-07: `(workspace_id, user_id)` UNIQUE 제약 추가
- `routine`, `habit`: 개인 소유 (`user_id = auth.uid()`), workspace 무관
- `meal`, `schedule`, `notice`: 2026-07-07 정책 분리 — SELECT/INSERT는 `is_workspace_member(workspace_id)`(워크스페이스 멤버 전체), **UPDATE/DELETE는 작성자 전용**(`author_id = auth.uid()`, notice는 `created_by = auth.uid()`). 이전엔 `FOR ALL` 단일 정책이라 멤버 아무나 수정/삭제 가능했음
- `fridge_item`, `shopping_item`, `expense`, `diary`, `todo`: 전체 CRUD `is_workspace_member(workspace_id)` (그대로, 가족 공용 항목이라 작성자 제한 없음)
- `meal_participation`, `meal_like`, `meal_comment`, `notice_comment`: 각각 부모(`meal`/`notice`)의 `workspace_id`를 경유해 `is_workspace_member`로 확인

## 알려진 이슈 / TODO

- [ ] **최우선 확인 필요**: `users` 테이블 SELECT 정책이 본인 row로만 제한되어 있어, 다른 가족 구성원의 `avatar_color`/`avatar_text_color`/`avatar_image_url`이 화면에서 비어 보일 수 있음. 2026-07-07에 추가한 프로필 이미지 기능(가족 상태 카드, 끼니 참여자, 게시판 댓글 등에서 남의 사진 표시)이 이 문제 때문에 아예 동작하지 않을 수 있음 — 브라우저에서 실제 확인 후, 문제라면 `users` SELECT 정책을 워크스페이스 공유 멤버까지 허용하도록 수정 필요
- [ ] E 드라이브가 FAT32라서 `next build`(프로덕션 빌드)가 실패함 — NTFS 드라이브(C: 등)로 프로젝트 이전 필요. `next dev`는 정상 동작
- [ ] 장소 검색: 카카오 로컬 API 키가 없어 텍스트 직접 입력만 지원 (`PlaceInput.tsx`에 교체 지점 TODO 주석)
- [ ] 공휴일: 실제 공공데이터포털 API 대신 2026년 정적 목록만 지원 (`holidays.ts`)
- [ ] 습관/할 일: 등록 화면만 있고 목록/트래커 화면 없음
- [ ] 설정 탭 알림(push) 설정 미구현 (알림 페이지 `/notifications`와는 별개)
- [ ] 일정 파싱 에이전트: 음성(Whisper STT) 입력 미구현 — 마이크 버튼은 자리만 있고 비활성. 식탁/장바구니/게시판 등 일정 외 탭으로의 라우팅도 미구현(현재는 일정 탭 전용)
- [ ] `agent/` 서버는 아직 별도 배포 전(로컬 `python main.py`로만 실행) — Render 등에 배포 후 `NEXT_PUBLIC_AGENT_API_URL`과 `agent/.env`의 `ALLOWED_ORIGINS`를 실제 배포 도메인으로 갱신 필요
- [ ] 테마 선택값은 `localStorage`에만 저장됨(기기별 개별 적용) — 여러 기기 간 동기화가 필요해지면 `users.theme` 컬럼 추가 + 서버 액션으로 옮기는 마이그레이션 필요
- [ ] 홈 화면 태블릿(lg: 1024px~) 3단 컬럼 레이아웃은 코드로만 구현, 실제 태블릿/넓은 화면에서 육안 확인 안 됨 — 확인 필요
- [ ] Vercel 배포 여부 미확인
- [ ] `supabase/add_diary_habit_todo_and_schedule_columns.sql`, `supabase/add_notice_comment_and_avatar_storage.sql`, `supabase/fix_author_policies.sql`, `supabase/add_share_token.sql`, `supabase/add_workspace_member_unique.sql`, `supabase/add_home_layout.sql`을 라이브 DB에 실행했는지 확인 필요 — 특히 `add_notice_comment_and_avatar_storage.sql`이 실행되어 있지 않으면 프로필 이미지 업로드가 실패함(2026-07-08에 에러 메시지를 구체화했으니 실패 시 화면에 실제 원인이 보일 것). `fix_author_policies.sql`/`add_share_token.sql`을 실행하기 전에는 코드리뷰로 고친 보안 이슈들이 앱 코드만으로는 절반만 막힌 상태(RLS는 여전히 예전 정책)임
- [ ] `regenerateShareToken`은 앱 코드에서 오너 여부를 확인하지만, `family_workspace`의 RLS `UPDATE` 정책은 여전히 `is_workspace_member`(멤버 전체 허용)라서 DB만 놓고 보면 오너가 아닌 멤버도 직접 API를 호출하면 공유 토큰을 바꿀 수 있음 — `meal`/`schedule`/`notice`에 적용한 것과 같은 방식으로 `family_workspace` UPDATE도 오너 전용 정책으로 분리할지 검토 필요 (이번 작업 범위에는 포함되지 않았음)
- [ ] Next.js Link의 `prefetch`는 기본값 그대로라 이미 켜져 있지만, 각 탭이 `requireWorkspaceContext()`로 매번 동적 렌더링을 하기 때문에 prefetch가 데이터까지 미리 가져오진 않음 — 탭 전환 체감 속도를 더 개선하려면 `loading.tsx` 스켈레톤 추가나 클라이언트 캐싱(SWR 등) 도입을 검토할 것 (이번엔 쿼리 병렬화까지만 진행)
- [ ] 2026-07-08 로그인 화면 재구성 + 자동 로그인: 이 환경엔 브라우저 자동화 도구가 없어 라이트/다크 스크린샷 검증과 "브라우저 완전 종료 후 재접속" 세션 유지/만료 테스트를 직접 하지 못했음 — `npx tsc --noEmit` 클린 + `next dev` 컴파일/라우트 상태코드(`/login` 200, `/home` 307)까지만 확인됨. 사용자가 직접 두 시나리오(체크 → 종료 → 재접속 시 `/home` 진입 / 체크 해제 → 종료 → 재접속 시 `/login`)를 브라우저에서 확인 필요

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
  4. `supabase/fix_author_policies.sql`
  5. `supabase/add_share_token.sql`
  6. `supabase/add_workspace_member_unique.sql`
  7. `supabase/add_home_layout.sql`
- `next build`는 FAT32 드라이브 이슈로 실패할 수 있음 — 변경 검증은 `next dev` + 브라우저/curl 확인으로 진행

### 일정 파싱 에이전트(`agent/`) 로컬 실행

Next.js와 별도 프로세스로 떠 있어야 하는 Python 서버다. 둘 다 띄워야 플로팅 에이전트가 동작한다.

```bash
cd agent
python -m venv .venv
.venv/Scripts/activate        # macOS/Linux는 source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # .env에 GEMINI_API_KEY 채워넣기
python main.py                 # http://localhost:8000
```
- `GET /health`로 기동 확인, `POST /process-schedule`이 실제 파싱 엔드포인트
- Next.js 쪽 `.env.local`에 `NEXT_PUBLIC_AGENT_API_URL=http://localhost:8000` 필요(로컬 기본값과 동일하면 생략 가능)
- 아직 별도 배포 전 — Render 등에 배포할 예정이며, 배포 후 `agent/.env`의 `ALLOWED_ORIGINS`와 Next.js의 `NEXT_PUBLIC_AGENT_API_URL`을 실제 배포 도메인으로 갱신할 것
- Windows 콘솔에 한글 로그가 깨져 보일 수 있음(코드페이지 문제, 실제 API 응답 JSON은 항상 UTF-8이라 영향 없음) — 필요하면 `PYTHONUTF8=1 python main.py`로 실행

---

### 유지 규칙
- 새 기능을 추가하거나 버그를 고칠 때마다 "진행 현황", "Supabase 스키마 현황", "알려진 이슈 / TODO" 를 그 자리에서 갱신한다.
- 값(API 키, 토큰 등)은 절대 이 파일에 기록하지 않는다 — 키 이름만.
