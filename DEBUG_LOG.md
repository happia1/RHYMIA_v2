# 디버깅 로그

## 2026-07-05

### 이슈: family_workspace / workspace_member RLS 정책 누락 (최초 스키마 버그)
- 증상: 워크스페이스·멤버 관련 테이블에 대한 모든 읽기/쓰기가 막힘
- 원인: PRD에 포함된 원본 SQL이 `family_workspace`, `workspace_member` 등에 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`만 적용하고 정책(POLICY)을 하나도 정의하지 않음 — RLS는 활성화됐지만 정책이 0개면 기본적으로 모든 접근이 거부됨
- 해결: `supabase/schema.sql`을 수정해 `is_workspace_member()` SECURITY DEFINER 헬퍼 함수를 추가하고(workspace_member 자기 참조 재귀 문제 회피), 테이블별 정책을 새로 작성
- 관련 파일: `supabase/schema.sql`
- 상태: 해결됨

### 이슈: E 드라이브 FAT32로 인한 next build 실패
- 증상: `npm install`이 비정상적으로 느림(패키지가 많은 의존성 기준 약 20분), `next build`가 `EISDIR: illegal operation on a directory, readlink` 에러로 실패
- 원인: 프로젝트가 FAT32 포맷 이동식 E 드라이브에 있어 심볼릭 링크/reparse-point를 제대로 지원하지 않음. webpack의 심볼릭 링크 해석과 FlightClientEntryPlugin이 FAT32의 readlink 동작에서 깨짐 (심볼릭 링크가 아닌 일반 소스 파일에서도 발생)
- 해결: `next.config.mjs`에 `config.resolve.symlinks = false` 적용 — module 해석 문제는 해결되지만 FlightClientEntryPlugin 크래시는 남아 `next build` 자체는 여전히 완료되지 않음
- 관련 파일: `next.config.mjs`
- 상태: 미해결. `next dev`로만 동작을 확인 중이며, 프로덕션 빌드 검증이 필요해지면 NTFS 드라이브(C: 등)로 프로젝트를 이전해야 함

## 2026-07-06

### 이슈: family_workspace INSERT 시 RLS 위반 (닭-달걀 문제)
- 증상: 워크스페이스 생성 시 `new row violates row-level security policy for table "family_workspace"` 에러. `workspace_insert` 정책(`WITH CHECK auth.uid() IS NOT NULL`)과 테이블 GRANT 권한을 모두 확인했지만 정상이었는데도 계속 실패
- 진단 과정:
  1. `pg_policies`/`pg_class`/`information_schema.role_table_grants`로 정책·RLS 활성화·권한을 직접 조회 — 이상 없음
  2. 실제 로그인 세션에서 `auth.uid()`/`auth.role()`을 반환하는 디버그 SQL 함수를 만들어 Server Action에서 호출 — 올바른 uid, `authenticated` 롤로 정상 확인
  3. SQL Editor에서 `SET LOCAL ROLE authenticated` + `SET LOCAL request.jwt.claims`로 동일한 role/claims를 흉내내 직접 INSERT — 그래도 동일하게 실패 → 앱/세션/PostgREST 계층 문제가 아니라 순수 Postgres RLS 평가 문제로 범위가 좁혀짐
- 원인: `.from("family_workspace").insert({ name }).select("id").single()` 코드가 INSERT에 `RETURNING`을 요청하고 있었는데, Postgres는 INSERT ... RETURNING의 결과를 INSERT 정책이 아니라 **테이블의 SELECT 정책**(`workspace_select: is_workspace_member(id)`)으로도 재검사함. 방금 만든 워크스페이스는 아직 `workspace_member`가 없으므로 SELECT 정책을 통과하지 못해 RLS 위반으로 처리됨
- 해결: 클라이언트/서버 액션에서 `crypto.randomUUID()`로 id를 미리 생성해 그 id로 insert하고, `.select()`/`.single()` 자체를 제거해 `RETURNING`을 요청하지 않도록 변경
- 관련 파일: `src/app/workspace/actions.ts` (`createWorkspace`)
- 상태: 해결됨. 이후 추가한 `diary`/`habit`/`todo`/`schedule` insert 로직에도 동일 패턴(클라이언트 측 UUID 생성 + `.select()` 미사용)을 일관되게 적용

## 2026-07-07

### 이슈: workspace_member FK 제약 위반 (users row 누락)
- 증상: `family_workspace` insert는 성공했는데 바로 다음 `workspace_member` insert에서 `insert or update on table "workspace_member" violates foreign key constraint "workspace_member_user_id_fkey"` 에러
- 진단 과정: `public.users`에서 해당 `user_id`로 조회 → row 없음 확인. `users` 테이블 자체의 RLS 정책(`auth.uid() = id` 기준 INSERT 허용)과 GRANT는 정상이었음 → 정책 문제가 아니라,애초에 회원가입/로그인 시 `users` upsert가 실패했는데 그 에러를 확인하지 않고 넘어간 것으로 판단
- 원인: 로그인/회원가입 흐름(`completeEmailAuth`, `auth/callback` 라우트)에 `public.users` upsert 코드는 있었지만 반환된 `error`를 전혀 검사하지 않아, 실패해도 화면상으로는 그대로 다음 단계(워크스페이스 생성 화면)로 넘어가 버림
- 해결:
  1. 누락된 계정에 대해 SQL로 `users` row를 수동 backfill해 즉시 언블록
  2. `completeEmailAuth()`와 `auth/callback/route.ts`의 upsert 호출에 `error` 체크 + `console.error` 로깅 + 에러 throw 추가
  3. 로그인 페이지에서 그 에러를 잡아 사용자에게 메시지로 보여주도록 try/catch 추가 (Next.js `redirect()`는 내부적으로 예외를 던지는 방식이라, redirect로 인한 예외는 구분해서 다시 던지도록 처리)
- 관련 파일: `src/app/(auth)/login/actions.ts`, `src/app/auth/callback/route.ts`, `src/app/(auth)/login/page.tsx`
- 상태: 해결됨. 다만 "최초 upsert가 왜 조용히 실패했는지"의 근본 원인은 당시 에러 로깅이 없어 확정하지 못함 — 앞으로 같은 문제가 재발하면 이제는 콘솔에 에러가 남으므로 원인 특정 가능

### 이슈: 로그인 페이지에서 존재하지 않는 next/navigation API 사용 (`unstable_rethrow`)
- 증상: `npx tsc --noEmit` 실행 시 `Module '"next/navigation"' has no exported member 'unstable_rethrow'` 타입 에러
- 원인: Server Action 호출을 try/catch로 감싸면서 Next.js `redirect()`의 내부 예외를 구분하려고 `unstable_rethrow`를 사용했는데, 이 프로젝트의 Next.js 버전(14.2.35)에는 아직 해당 API가 없음(이후 버전에서 추가됨)
- 해결: 에러 객체의 `digest` 문자열이 `"NEXT_REDIRECT"`로 시작하는지 직접 확인하는 로컬 `isRedirectError()` 헬퍼로 대체
- 관련 파일: `src/app/(auth)/login/page.tsx`
- 상태: 해결됨

### 이슈: "오늘 뭐먹지?" 카드에 저녁을 등록해도 간식만 보임
- 증상: 홈 화면 "오늘 뭐먹지?" 카드에 오늘 저녁+간식을 모두 등록했는데 간식만 표시됨
- 원인: `findUpcomingMeal()`이 여러 끼니 중 "다음으로 다가올 하나"만 골라 반환하는 함수였음. 저녁(18시 기준)과 간식(15시 기준) 모두 현재 시각보다 이른 시각이 되면 `sorted.find()`가 아무것도 못 찾아 `sorted[0]`으로 폴백하는데, 정렬 기준이 `MEAL_TAGS` 배열 순서(아침→브런치→점심→간식→저녁→야식)라서 간식이 저녁보다 먼저 나와 간식만 보이고 저녁은 아예 표시되지 않음
- 해결: 근본적으로 "하나만 고르는" 방식을 버리고, 오늘 등록된 끼니를 전부 `tagOrderIndex` 기준으로 정렬해 가로 스와이프 캐러셀로 보여주도록 변경 (오늘 등록된 끼니가 없을 때만 `findUpcomingMeal`로 다음 끼니 하나를 폴백으로 사용)
- 관련 파일: `src/app/(main)/home/page.tsx`, `src/components/home/MealSummaryCard.tsx`
- 상태: 해결됨

### 이슈: 서버 액션에 작성자 권한 검증 없음 (코드리뷰 지적)
- 증상: `updateMeal`/`deleteSchedule`/`deleteNotice`가 로그인 여부·작성자 일치 여부를 전혀 확인하지 않고 실행됨. `mealId`/`scheduleId`/`noticeId`만 알면(URL 등으로 추측 가능) 다른 사람이 만든 끼니/일정/공지를 수정·삭제할 수 있는 구조였음
- 원인: RLS가 `is_workspace_member(workspace_id)` 기준의 `FOR ALL` 단일 정책이라 "같은 워크스페이스 멤버면 전부 허용" 상태였고, 서버 액션 코드에도 별도의 소유자 확인 로직이 없었음 (RLS만 믿고 앱 코드에서는 검증 생략)
- 해결: 세 액션 모두 `auth.getUser()`로 로그인 확인 → 대상 row의 `author_id`(`notice`는 `created_by`)가 `user.id`와 일치하는지 조회 후 실행하도록 변경. RLS도 `meal`/`schedule`/`notice`의 `UPDATE`/`DELETE`를 작성자 전용 정책으로 분리(SELECT/INSERT는 기존처럼 워크스페이스 멤버 전체 허용)
- 관련 파일: `src/app/(main)/food/actions.ts`(`updateMeal`), `src/app/(main)/schedule/actions.ts`(`deleteSchedule`), `src/app/(main)/board/actions.ts`(`deleteNotice`), `supabase/fix_author_policies.sql`
- 상태: 해결됨. 앱 코드가 이미 소유자를 확인하므로 RLS는 방어 심층화(defense-in-depth) 목적 — 하나가 뚫려도 다른 하나가 막음

### 이슈: 외부 공유 링크가 초대 링크와 같은 식별자(workspace_id) 재사용
- 증상: `/share/{workspaceId}` 공개 읽기 전용 링크와 `/workspace/join/{workspaceId}` 가족 초대 링크가 동일한 UUID를 그대로 씀. 공유 링크가 유출되면 그 값으로 가족 초대 링크에도 접근 가능(가입 시도 가능)했고, 공유 링크를 무효화할 방법이 없었음(워크스페이스 삭제 전까지 영구 유효)
- 원인: 별도의 공유 전용 토큰 개념이 없었고, `workspace_id`가 여러 용도(DB 기본키, 초대 링크, 공유 링크)에 동시에 쓰이고 있었음
- 해결: `family_workspace`에 `share_token`(UUID, 기본값 랜덤 생성) 컬럼 추가. `/share/[workspaceId]` 라우트를 `/share/[token]`으로 교체해 `share_token`으로 조회하도록 변경. 설정 화면 공유 링크도 토큰 기반으로 교체하고, 오너 전용 "링크 재발급" 버튼 추가(누르면 `share_token`을 새로 발급해 기존 링크를 무효화)
- 관련 파일: `src/app/share/[token]/page.tsx`(신규, 기존 `[workspaceId]` 폴더 삭제), `src/app/(main)/settings/actions.ts`(`regenerateShareToken`), `src/components/settings/ShareLinkSection.tsx`(신규), `supabase/add_share_token.sql`
- 상태: 해결됨

### 이슈: 서버 액션 대부분이 Supabase 에러를 확인하지 않고 무시함
- 증상: `board/actions.ts`, `home/actions.ts`, `food/actions.ts`, `schedule/actions.ts`, `settings/actions.ts`, `joinWorkspace` 등에서 `await supabase.from(...).insert/update/delete(...)`를 호출한 뒤 반환된 `error`를 확인하지 않는 코드가 다수 있었음 — DB 작업이 실패해도 화면은 "성공한 것처럼" 넘어감 (이번 세션에서 다룬 `users` upsert 실패 사례와 같은 근본 패턴)
- 원인: 초기 개발 시 happy path만 작성하고 에러 분기를 생략한 코드가 누적됨. 일부 함수(`createMeal`, `createSchedule`, `createDiary` 등)는 이미 에러를 확인하도록 되어 있어 패턴이 일관되지 않았음
- 해결: 코드리뷰에서 지적된 4개 파일(`board/actions.ts`, `home/actions.ts`, `joinWorkspace`, `toggleMealLike`)뿐 아니라, 뮤테이션을 수행하는 서버 액션 전체를 훑어서 에러를 확인하지 않던 자리에 전부 `if (error) throw new Error(error.message)` 추가
- 관련 파일: `src/app/(main)/board/actions.ts`, `src/app/(main)/home/actions.ts`, `src/app/(main)/food/actions.ts`, `src/app/(main)/schedule/actions.ts`, `src/app/(main)/settings/actions.ts`, `src/app/workspace/actions.ts`
- 상태: 해결됨(뮤테이션 액션 기준). `src/lib/workspace.ts`의 멤버십 조회, 로그인 콜백의 워크스페이스 조회, `/share` 페이지의 읽기 쿼리 등 일부 **읽기 전용** 호출은 의도적으로 그대로 둠 — 실패 시 온보딩 화면으로 보내거나 빈 목록을 보여주는 정도로 완만하게 처리되는 지점이라, 하드 에러로 바꾸면 일시적 네트워크 문제에도 사용자가 크래시 화면을 보게 되는 역효과가 있음

### 이슈: joinWorkspace에 정원 제한·중복 가입 방지 없음
- 증상: `family_workspace.member_limit`을 확인하지 않아 정원을 넘겨도 계속 가입이 가능했고, 이미 가입된 사용자가 초대 링크를 다시 열면 `workspace_member`에 중복 row가 insert됨(제약 없음)
- 원인: `joinWorkspace`가 멤버 수/정원, 기존 가입 여부를 전혀 조회하지 않고 바로 insert
- 해결: insert 전에 (1) 이미 해당 워크스페이스 멤버인지 조회해서 맞으면 `/home`으로 리다이렉트, (2) `family_workspace.member_limit` 대비 현재 멤버 수를 조회해 초과 시 에러 throw. DB에도 `workspace_member(workspace_id, user_id)` UNIQUE 제약을 추가해 동시 요청 레이스 컨디션에도 중복 삽입이 막히도록 함
- 관련 파일: `src/app/workspace/actions.ts`(`joinWorkspace`), `supabase/add_workspace_member_unique.sql`
- 상태: 해결됨

## 2026-07-08

### 이슈: 다크 모드를 선택해도 화면이 안 바뀜 (근본 원인: tailwind content 설정 누락)
- 증상: 설정 화면에서 "다크"를 선택해도 화면이 전혀 바뀌지 않음. 홈 화면조차도 변화가 거의 없어 보임
- 진단 과정: `ThemeProvider`/`ThemeToggle`/`globals.css`의 CSS 변수 정의는 전부 정상이었음(코드만 보면 문제가 없어 보임). 하지만 `tailwind.config.ts`의 `content` 배열이 `src/pages`, `src/components`, `src/app`만 포함하고 **`src/lib`를 빠뜨리고 있었음** — 홈 화면 전용 색상 토큰(`mirror.bg`, `mirror.primary` 등, `bg-[var(--bg-page)]` 같은 실제 클래스 문자열)이 정의된 `src/lib/homeTheme.ts`가 스캔 대상에서 빠져 있었던 것. Tailwind는 파일 텍스트를 정적으로 스캔해 실제 쓰인 클래스만 CSS로 생성하는데, `mirror.primary` 같은 변수 참조만 있는 파일(예: `HomeHeader.tsx`)에는 클래스 문자열 원문("text-[var(--text-primary)]")이 존재하지 않고, 그 원문이 있는 유일한 파일(`homeTheme.ts`)은 스캔 대상이 아니었으므로 **해당 유틸리티 클래스들이 아예 CSS로 생성되지 않고 있었음**. 거기에 더해 식탁/일정/게시판/설정 탭은 애초에 `cream`/`ink`/`stone` 같은 고정 hex 색상만 썼기 때문에 테마를 바꿔도 반응할 여지 자체가 없었음(1차 원인)
- 해결: (1) `tailwind.config.ts`의 `content`를 `./src/**/*.{js,ts,jsx,tsx,mdx}` 하나로 넓혀 `src/lib`도 스캔되게 함. (2) `cream`/`ink`/`stone`/`border-light` Tailwind 색상 토큰 자체를 `#hex` 고정값에서 `var(--bg-page)` 등 CSS 변수 참조로 바꿔서, 이미 앱 전체에 쓰이고 있던 기존 클래스들이 자동으로 다크 모드에 반응하도록 만듦. 카드 배경으로 쓰이던 `bg-white`는 새 `--bg-surface` 변수 기반 `bg-surface` 토큰으로 교체(로그인/공유/워크스페이스 생성 페이지 등 공개 페이지는 의도적으로 그대로 둠)
- 관련 파일: `tailwind.config.ts`, `src/app/globals.css`, 17개 컴포넌트/페이지 파일(`bg-white` → `bg-surface`)
- 상태: 해결됨. `content` 글롭 누락은 앞으로도 재발할 수 있는 종류의 실수라 — 새 `src/lib/*.ts` 파일에 Tailwind 클래스 문자열을 넣을 때는 항상 실제 렌더링까지 확인할 것

### 이슈: 섹션 구분 헤어라인이 안 보임
- 증상: 홈 화면 섹션 사이 0.5px 헤어라인이 렌더링되지 않음
- 원인: 위와 같은 근본 원인(`tailwind.config.ts` content 글롭에 `src/lib` 누락) — `mirror.hairlineBg`(`bg-[var(--hairline)]`) 클래스가 CSS로 생성되지 않아 배경색 없이 빈 1px div만 존재했음
- 해결: content 글롭 수정으로 함께 해결됨 (위 항목 참고)
- 관련 파일: `tailwind.config.ts`
- 상태: 해결됨

### 이슈: 독바가 투명해서 스크롤 시 콘텐츠와 겹쳐 보임
- 증상: 목록을 스크롤하면 독바 영역을 지나가는 텍스트가 독바 아이콘과 겹쳐 보임
- 원인: 지난 세션에 "배경/테두리 없이 아이콘+텍스트만"으로 독바를 스마트미러 스타일에 맞춰 완전히 투명하게 만들었는데, `fixed` 배치라 스크롤 중인 콘텐츠가 투명한 독바 뒤로/위로 그대로 비쳐 보임. 페이지 하단 패딩은 "맨 끝까지 스크롤했을 때"만 도움이 되고, 스크롤 도중 독바 영역을 지나가는 콘텐츠에는 효과가 없음
- 해결: 독바에 `bg-cream`(테마 변수 기반이라 다크 모드에서도 자동으로 맞는 색) 배경을 다시 적용
- 관련 파일: `src/components/ui/DockBar.tsx`
- 상태: 해결됨

### 이슈: 홈/식탁/일정 페이지에서 서로 무관한 쿼리를 불필요하게 순차 실행
- 증상: 독바 탭 전환이 느리게 느껴짐
- 원인: `home/page.tsx`, `food/page.tsx`, `schedule/page.tsx` 모두 `workspace_member` 조회(멤버 목록)를 다른 쿼리와 아무 의존관계가 없는데도 `Promise.all` 밖에서 먼저 `await`하고, 그 다음에야 나머지 쿼리들을 병렬 실행하고 있었음. `schedule/page.tsx`는 특히 memberRows → scheduleRows → weather → myRoutineRows까지 4단계가 전부 순차였음(넷 다 서로 독립적인데도)
- 해결: 서로 의존관계가 없는 쿼리를 전부 하나의 `Promise.all`로 합침. `home/page.tsx`는 `routine` 쿼리만 `memberIds`가 필요해서 여전히 그 뒤에 남겨둠(진짜 의존관계가 있는 유일한 경우)
- 관련 파일: `src/app/(main)/home/page.tsx`, `src/app/(main)/food/page.tsx`, `src/app/(main)/schedule/page.tsx`
- 상태: 해결됨. Next.js Link의 `prefetch`는 기본값(활성화)을 바꾼 적이 없어 별도 조치 없음 — 다만 각 탭이 `requireWorkspaceContext()`로 매번 인증 쿠키 기반 동적 렌더링을 하므로 prefetch가 전체 데이터까지 미리 가져오지는 않음(App Router의 기본 동작이며 이번 범위에서 더 손대지 않음)

### 이슈: 프로필 사진 업로드 실패 시 원인을 알 수 없음
- 증상: "업로드에 실패했습니다"라는 뭉뚱그린 메시지만 뜨고 실제 원인(버킷 없음/RLS 거부/네트워크 등)을 알 수 없음
- 원인: `AvatarUploader`가 Supabase의 실제 에러 메시지를 버리고 고정 문구만 보여주고 있었음. `avatars` 스토리지 버킷 SQL(`supabase/add_notice_comment_and_avatar_storage.sql`)은 검토 결과 정책 자체는 정상— 다만 라이브 DB에 실행됐는지는 여기서 확인 불가능함
- 해결: 콘솔에 `console.error`로 전체 에러 객체를 남기고, 화면에도 Supabase가 반환한 실제 `error.message`를 붙여서 보여주도록 변경 (`updateAvatarImage`/`clearAvatarImage` 호출부도 동일하게 보강)
- 관련 파일: `src/components/settings/AvatarUploader.tsx`
- 상태: 부분 해결 — 에러 메시지는 이제 구체적으로 보이지만, 실제 업로드가 되려면 `supabase/add_notice_comment_and_avatar_storage.sql`이 라이브 DB에 실행되어 있어야 함(미실행 상태면 이제는 "bucket not found" 류의 실제 원인이 화면에 보일 것)

### 이슈: 다크 모드에서 로그인 화면 버튼 글자가 안 보임
- 증상: 로그인 화면의 "구글로 시작하기"/"회원가입" 등 버튼이 다크 모드에서 배경과 글자색이 거의 같은 색으로 보여 내용을 읽을 수 없음
- 원인: 버튼 배경이 `bg-white`(리터럴 흰색, 테마 무관 고정값)로 하드코딩되어 있는데 글자색은 `text-ink`(CSS 변수 기반, 다크 모드에서 흰색에 가깝게 바뀜)를 사용 — 배경은 항상 흰색, 글자도 다크 모드에서 흰색이 되어 흰 배경 위에 흰 글씨가 되는 구조였음. 같은 패턴(하드코딩된 `bg-white` + 테마 변수 텍스트)이 `workspace/page.tsx`, `workspace/join/[workspaceId]/page.tsx`, `share/[token]/page.tsx`에도 있었음
- 해결: 배경과 글자색을 항상 짝으로 테마 변수화. `globals.css`에 `--btn-surface-bg`/`--btn-surface-text` 변수 쌍 추가(라이트 `#FFFFFF`/`#1A1A18`, 다크 `#26262C`/`#FFFFFF`) 및 `tailwind.config.ts`에 `btn-surface`/`btn-surface-text` 토큰 등록. 위 3개 페이지의 리터럴 `bg-white`는 이미 테마 변수인 `bg-surface`로 교체
- 관련 파일: `src/app/globals.css`, `tailwind.config.ts`, `src/app/(auth)/login/page.tsx`, `src/app/workspace/page.tsx`, `src/app/workspace/join/[workspaceId]/page.tsx`, `src/app/share/[token]/page.tsx`
- 상태: 해결됨. 배경색을 하드코딩할 때는 반드시 짝이 되는 텍스트 색도 같은 방식(둘 다 리터럴 또는 둘 다 테마 변수)으로 맞추는 규칙을 앞으로도 지킬 것

### 이슈: 다크 모드에서 입력창(input/textarea) 글자가 안 보임 (앱 전체)
- 증상: 할 일 등록, 일정 등록, 습관 등록, 메모/공지 작성 등 거의 모든 입력 시트에서 다크 모드일 때 입력창 배경이 흰색으로 보이고 글자도 밝은 색이라 타이핑한 내용이 안 보임. 로그인 화면 버튼 버그(위 항목)와 겉보기엔 같은 증상이지만 원인은 달랐음
- 원인: 대부분의 `<input>`/`<textarea>`가 `border`/`text-ink`/`placeholder:text-stone`만 지정하고 **배경색 클래스를 아예 지정하지 않고 있었음**. 브라우저는 배경 지정이 없는 폼 컨트롤을 항상 흰색으로 렌더링하므로(부모로부터 배경을 상속하지 않음), `text-ink`가 다크 모드에서 흰색이 되는 순간 흰 배경 위에 흰 글씨가 되는 구조였음. 체크박스도 배경/테두리 지정이 전혀 없어 다크 배경 위에서 잘 안 보임
- 해결: `--input-bg`/`--input-text`/`--input-placeholder`/`--input-border` 4개 변수 쌍을 신설(globals.css, 라이트/다크 각각)하고, `tailwind.config.ts`에 `input`/`input-text`/`input-placeholder`/`input-border` 토큰 등록. 공용 `components/ui/Input.tsx`(`Input`/`Textarea`)를 새로 만들어 이 4개 색상 클래스만 강제하고, 크기(h-*/rounded-*/px-*/text-*)는 호출부에서 지정하도록 분리(같은 카테고리의 Tailwind 유틸리티가 겹치면 JSX 순서와 무관하게 내부 생성 순서로 승패가 갈리는 문제를 피하기 위함). 앱 전체 12개 파일의 raw input/textarea를 이 컴포넌트로 교체. 체크박스/라디오는 `globals.css`에 전역 규칙(`accent-color: var(--accent-honey)` + `border: 1px solid var(--input-border)`)을 추가하고 `color-scheme: light dark`를 지정해 네이티브 렌더링도 테마에 맞춤
- 관련 파일: `src/app/globals.css`, `tailwind.config.ts`, `src/components/ui/Input.tsx`(신규), `src/app/(auth)/login/page.tsx`, `src/app/workspace/page.tsx`, `src/app/workspace/join/[workspaceId]/page.tsx`, `src/components/schedule/{AddEventSheet,TodoSheet,HabitSheet,DiarySheet,RoutineEditor,PlaceInput}.tsx`, `src/components/food/{MealDetail,AddMealScreen}.tsx`, `src/components/home/{ShoppingList,BoardSection}.tsx`, `src/components/agent/{AgentSheet,ConfirmCards}.tsx`
- 상태: 해결됨. 앞으로 입력 필드를 새로 만들 때는 반드시 `components/ui/Input.tsx`의 `Input`/`Textarea`를 사용하고, 배경색 없이 raw `<input>`/`<textarea>`를 쓰지 않을 것

### 이슈: 프로필 사진 업로드 시 "Invalid key" 에러
- 증상: 설정 탭에서 "사진 변경"으로 이미지를 고르면 "업로드에 실패했어요: Invalid key: {userId}/{timestamp}-스크린샷 2021-06-07 오전 11.46.22.png" 같은 에러가 뜸. 파일명에 한글/공백이 없는 파일(예: `photo.jpg`)은 정상 업로드됨
- 원인: `AvatarUploader`가 업로드 경로를 `${userId}/${Date.now()}-${file.name}`으로 만들면서 사용자가 고른 원본 파일명을 그대로 붙이고 있었음. Supabase Storage는 오브젝트 키에 공백·한글 등 비-ASCII 문자가 섞이면 서버에서 곧바로 "Invalid key"로 거부함(클라이언트 라이브러리가 아니라 스토리지 서버 쪽 키 검증) — 스크린샷 파일명처럼 한글+공백이 포함된 기본 파일명에서 항상 재현됨
- 해결: 원본 파일명을 아예 쓰지 않고, 확장자만 안전하게 추출해 `${userId}/${Date.now()}.${ext}` 형태로 키를 생성하도록 변경 (확장자를 못 찾으면 `png`로 폴백)
- 관련 파일: `src/components/settings/AvatarUploader.tsx`
- 상태: 해결됨. 앞으로 Storage에 사용자 파일을 올릴 때는 원본 파일명을 키에 그대로 쓰지 말고, 항상 안전하게 생성한 이름(또는 화이트리스트로 정제한 이름)을 사용할 것

---

### 기록 규칙
- 새 버그를 진단/수정할 때마다 위 형식(날짜 → 이슈 → 증상 → 원인 → 해결 → 관련 파일 / 상태)으로 이 파일에 항목을 추가한다.
- "원인"이 추정일 뿐 확정되지 않은 경우 그렇게 명시한다 (근거 없는 확신 금지).
- 미해결 이슈는 상태를 "미해결"로 남기고, 해결되면 같은 항목을 갱신한다.
