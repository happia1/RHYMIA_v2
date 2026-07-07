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

---

### 기록 규칙
- 새 버그를 진단/수정할 때마다 위 형식(날짜 → 이슈 → 증상 → 원인 → 해결 → 관련 파일 / 상태)으로 이 파일에 항목을 추가한다.
- "원인"이 추정일 뿐 확정되지 않은 경우 그렇게 명시한다 (근거 없는 확신 금지).
- 미해결 이슈는 상태를 "미해결"로 남기고, 해결되면 같은 항목을 갱신한다.
