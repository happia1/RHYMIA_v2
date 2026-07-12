# 개발 참조 문서

## 마지막 업데이트: 2026-07-12 (에이전트 프록시 보안 보강 — 로그인 검증 + 이미지 클라이언트 압축)

- 2026-07-12: 에이전트 프록시(`/api/agent/*`) 보안 보강 2건 — ① `src/lib/agentServer.ts`에 `requireAuthOrRespond()` 헬퍼 추가: `supabase.auth.getUser()`로 로그인 여부를 확인해 미로그인이면 `401 { error: "로그인이 필요합니다." }`를 반환(에이전트 서버로는 아예 넘기지 않음), 로그인 상태면 `null`을 반환해 계속 진행. `process-schedule`/`extract-text` 두 route.ts가 각자 검증 코드를 중복 작성하는 대신 이 헬퍼 하나를 공유 — 실제로 인증 쿠키 없이 두 라우트를 호출해 둘 다 401이 뜨는 것까지 확인함. ② `src/lib/imageCompress.ts` 신규 — 에이전트로 이미지를 보내는 두 지점(일정 파싱 에이전트의 사진 첨부 `AgentSheet.tsx`, 메모/공지 "사진에서 텍스트 채우기" `BoardSection.tsx`)에서 base64 인코딩 전에 canvas로 리사이즈: 장변이 1600px 넘으면 축소하고 JPEG 품질 0.85로 재인코딩, 압축 결과가 원본보다 크면(이미 작은 이미지 등) 원본 그대로 사용. Next.js API 라우트가 Vercel에 배포되면 요청 바디가 4.5MB로 제한되는데 스마트폰 카메라 원본은 base64 인코딩 시 이를 쉽게 넘기 때문에 클라이언트에서 미리 줄여 보내려는 목적 — 두 지점 다 기존에 각자 갖고 있던 `FileReader.readAsDataURL` 직접 호출(`AgentSheet.tsx`의 인라인 코드, `BoardSection.tsx`의 `fileToBase64()`)을 이 공용 유틸 호출로 교체 (아래 "일정 파싱 에이전트"/"게시판 탭" 섹션 참고)

- 2026-07-12: 반복 일정(기념일·생신·연간행사) 데이터 레이어 작업 — **화면(수정 시트 등)은 다음 작업에서 이어감**, 이번엔 스키마/유틸/액션/등록 폼까지만.
  - `supabase/add_schedule_recurrence.sql` 신규(실행 필요) — `schedule`에 `recur_type`('none'|'monthly'|'yearly', 기본 none) / `recur_calendar`('solar'|'lunar', 기본 solar) / `recur_until`(DATE, NULL이면 무기한) 컬럼 추가. **weekly는 의도적으로 제외**— 매주 반복은 routine(내 루틴)이 전담하는 영역이라는 주석 명시. CHECK 제약은 `ADD COLUMN IF NOT EXISTS`가 안 통해서 `pg_constraint` 확인 후 추가하는 방식으로 재실행 안전 처리. 컬럼 추가만이라 별도 GRANT는 불필요(새 테이블/새 정책이 아니라 기존 `schedule` 테이블 권한 범위에 자동 포함) — GRANT 관례를 확인한 결과.
  - `src/lib/lunar.ts` 신규 — 외부 라이브러리 없이 `Intl.DateTimeFormat('ko-u-ca-dangi')`(단기 캘린더)로 음력 변환. `solarToLunar(date)`가 `{month, day, isLeap}` 반환, `lunarToSolarInYear(year, month, day)`가 특정 양력 연도 안에서 그 음력 월일에 해당하는 양력 날짜를 역으로 찾음(그 해 365/366일을 한 번 순회해 "음력 월-일(평달만) → 양력 날짜" 맵을 만들고 연도별로 메모이제이션). 그 달이 작은달이라 음력 30일이 없으면 29일로 폴백. 실제 Node ICU로 직접 검증하며 **"연도" 파트가 표준 `year`가 아니라 `relatedYear`로 나온다는 걸 확인**해 지원 여부 판별 로직을 그에 맞게 수정(처음엔 `year` 파트 유무로 판별하려다 항상 false가 나오는 버그를 실행 중에 잡음). 윤달 표기가 "윤6"처럼 나오는 것도 실측 확인 — `parseMonthPart()`가 숫자만 추출하고 "윤" 포함 여부로 `isLeap` 판별. dangi 캘린더 자체를 못 만드는 런타임이면 모든 함수가 null 반환(호출부가 표기/전개 생략하도록)
  - `src/lib/recurrence.ts` 신규 — `expandRecurring(schedules, rangeStart, rangeEnd)`가 DB에 저장된 원본 한 행씩을 받아 그 범위 안의 가상 인스턴스만 계산해 반환(저장은 안 함). yearly+solar는 매년 같은 월일(2/29는 평년에 2/28로 클램프), yearly+lunar는 원본의 음력 월일을 한 번 구해두고 연도별로 `lunarToSolarInYear`로 양력 날짜 산출, monthly는 매월 같은 일(없는 달은 말일로 클램프, 31일→30일 등). `recur_until` 지나면 중단, 원본 자신의 날짜와 같은 인스턴스는 만들지 않음(중복 방지 — 원본은 별도 조회로 이미 나오므로). 반환값은 원본 필드를 그대로 복사하고 `id`만 합성(`{원본id}__{날짜}`)해 만들며 `isVirtual: true`/`originalId`를 덧붙임 — 기간(멀티데이) 일정은 시작~종료 간격을 유지한 채 이동. 실제 Node로 월간 클램프/윤년/음력 왕복/`recur_until`/기간유지/원본중복없음 6가지 시나리오를 전부 실행해 검증함
  - 일정 조회 — `schedule/actions.ts`에 `getSchedulesForRange(workspaceId, userId, rangeStart, rangeEnd)` 신규: ① 기존과 동일한 범위 내 원본 조회 ② `recur_type != 'none'`이고 `date_start <= 범위끝`이며 `recur_until`이 없거나 범위 시작 이후인 원본들을 가져와 `expandRecurring`으로 전개 → 두 결과를 합쳐 날짜순 정렬해 반환. 두 조회 모두 기존과 동일한 "공유거나 내가 만든 것만" 가시성 필터를 적용(RLS가 아니라 앱 코드가 담당하는 기존 규칙 그대로 유지). `schedule/page.tsx`가 하던 인라인 쿼리를 이 액션 호출로 교체하되, **월간/연간 뷰만** 이 확장 조회를 쓰고 **주간 뷰는 범위가 좁아 이번 범위에서 제외**(기존처럼 저장된 행만 조회) — `ExpandedSchedule`가 `Schedule`에 옵셔널 필드만 얹은 타입이라 `MonthView`/`WeekView`/`YearView`의 기존 `schedules: Schedule[]` prop 타입은 변경 없이 그대로 받음
  - `AddEventSheet`에 "반복" 선택(없음 기본/매월/매년) 추가, 매년 선택 시에만 양력/음력 토글 노출(기본 양력) → `createSchedule` 호출 시 `recur_type`/`recur_calendar`로 전달. **AddEventSheet는 여전히 신규 등록 전용**(수정 모드 없음, `updateSchedule` 액션도 아직 없음) — 가상 인스턴스를 열었을 때 "원본을 수정합니다" 안내를 보여주고 저장/삭제를 `originalId`로 라우팅하는 것, "이번 회만 수정" 예외 처리(P2)는 전부 **다음 작업(수정 화면 구현)으로 이연** — 코드에 그 취지의 주석을 남겨둠
  - ⚠️ `supabase/add_schedule_recurrence.sql` 실행 전까지는 `schedule` 테이블에 `recur_type` 등 컬럼이 없어 `createSchedule`의 insert가 실패함(컬럼 없음 에러) — 이 상태에서도 "반복 없음"으로만 쓰면 기존과 동일하게 동작하도록 값 자체는 기본값으로 보내지만, 컬럼이 없으면 어차피 insert 전체가 실패하므로 **먼저 마이그레이션을 실행해야 함**

- 2026-07-11: 끼니 추가/수정 화면(`AddMealScreen`)의 "메뉴" 입력란 왼쪽 끝에 이미지 삽입 아이콘 추가 — `meal.image_url` 컬럼은 스키마에 이미 있었지만 등록/수정 UI가 없어 항상 비어 있었음(`MealCard`/`MealDetail`은 이미 "image_url 있으면 썸네일, 없으면 emoji" 조건부 렌더링이 구현돼 있었으므로 업로드 경로만 새로 연결). 카메라 아이콘 탭 → `meal-images` 버킷에 브라우저 직접 업로드(다른 이미지 첨부와 동일한 `{user_id}/{filename}` 패턴) → 업로드되면 아이콘 자리에 작은 썸네일로 바뀌고 옆에 제거(x) 버튼 노출. `createMeal`/`updateMeal`(`food/actions.ts`)의 `MealInput`에 `image_url` 필드 추가. `supabase/add_meal_image.sql` 신규(버킷+RLS, 실행 필요)
- 2026-07-11: 식탁 탭 "오늘의 제안" 카드 문구 축약 — "메뉴를 랜덤으로 골라드려요" → "메뉴 랜덤 고르기", "냉장고 재고 추천" → "추천 레시피", "준비 중이에요" → "서비스 준비중" (`SuggestionSection.tsx`)

- 2026-07-11: 장바구니 시트(`GlobalShoppingSheet`)에 상단 세그먼트 [장볼 것 | 기록] 추가 — "장볼 것" 탭은 기존 메모장 리스트+음성입력을 유지하되 목록 필터를 `!is_purchased`(체크하면 즉시 사라짐) → `!expense_id`(체크해도 취소선인 채로 남아있다가 "장보기 완료"로 실제 묶여야 사라짐)로 바꿔 예전에 있던 "구매 완료 아카이브"를 대체. "장보기 완료" 폼은 구매처/금액 두 입력만 남기고(영수증 첨부 버튼·재고추가 토글 제거, 재고 추가는 항상 자동 실행) 확정 버튼명을 "기록하기"로 변경, `completeGroceryRun`이 place를 `expense.place` 전용 컬럼에 저장(예전엔 `memo` 겸용). 신규 "기록" 탭은 월 달력(grocery 있는 날 honey 점)+검색(품목/구매처, 300ms 디바운스)+회차 목록+회차 상세(품목·영수증 썸네일·자동입력 준비중 버튼)로 구성, 신규 서버 액션 `getGroceryRuns`/`searchGroceryRuns`이 `shopping_item`을 `expense_id IN (...)` 한 번으로만 조회해 N+1을 피함. `supabase/add_expense_place.sql` 신규(place 컬럼+메모 백필+`shopping_item.expense_id` 인덱스, 실행 필요) (아래 "장바구니(글로벌 시트)" 섹션 참고)

- 2026-07-11: 게시판 메모/공지 관련 버그 수정 4건 — ① 정렬 버그: 목록이 `is_pinned`만으로 정렬돼 공지(`type='notice'`)가 최신 메모보다 아래로 밀리는 문제 수정 — 고정 여부가 최우선, 그다음 공지가 항상 일반 메모보다 위(둘 다 같으면 기존 작성일 최신순 유지). ② 목록 행 작성자 정보 줄 왼쪽 끝의 용도 불분명한 핀 아이콘(`is_pinned`일 때만 보이던 `IconPin`) 삭제. ③ `AddPostSheet`(메모/공지 작성·수정 시트)에서 기존엔 신규 작성 시에만 보이던 메모/공지 토글 pill을 **수정 모드에서도 노출**하도록 변경해 수정 중 유형을 바꿀 수 있게 함 — `updateNotice`에 `type` 파라미터 추가(스티키는 색상/이미지/만료일 구조가 달라 전환 대상에서 제외, 메모⇄공지 사이에서만 허용). ④ 이미지 관련 기능 2종 분리 — 기존 카메라 아이콘 "사진에서 텍스트 채우기"(OCR) 버튼을 그대로 유지하되 아이콘을 `IconPhotoScan`으로 교체하고, 카메라 아이콘(`IconCamera`)은 새로운 "이미지 삽입" 버튼(스티키의 "사진 첨부"와 동일한 업로드 로직 재사용, `notice.image_url`을 메모/공지에도 저장 — 이전엔 sticky 전용이라 memo/notice에 첨부한 이미지는 텍스트 추출 후 버려졌음)에 배정. 상세 시트의 이미지 표시도 sticky 전용 조건을 없애 메모/공지에도 동일하게 적용 (아래 "게시판 탭" 섹션 참고)

- 2026-07-11: 홈 화면과 장바구니 UI 정리 — ① 독바를 홈/식탁/일정/게시판 4개로 원복, 독바에서 장바구니 항목 제거(진입은 홈의 장바구니 위젯 클릭으로만). ② 장바구니 팝업을 `GlobalShoppingSheet` 하나로 통일 — 홈 위젯의 + 버튼과 리스트 클릭이 서로 다른 시트(`ShoppingQuickAddSheet`)를 열던 중복을 없애고 둘 다 같은 시트를 열도록 변경, `ShoppingQuickAddSheet.tsx` 삭제. 시트 내부 항목 행(`ShoppingItemRow`)은 전체가 탭 영역이 되어 탭하면 체크(취소선)되고, 왼쪽으로 스와이프하거나 x를 눌러 삭제. 입력란 오른쪽에 마이크 아이콘 추가 — `webkitSpeechRecognition`(`ko-KR`) 지원 브라우저에서만 보이고, 인식 중엔 honey 색으로 표시. ③ 식탁 탭 "오늘의 제안" 캐러셀에 `scrollbar-hide` 클래스 추가(가로 스크롤은 유지, 스크롤바만 숨김). ④ 홈 화면을 `h-[calc(100dvh-64px)]` + `overflow-hidden`으로 고정해 페이지 자체는 스크롤되지 않게 하고, 헤더(히어로+가족 상태)는 고정 높이, 위젯 그리드 영역만 남은 높이를 차지하며 그 안에서만 `overflow-y-auto`(안전장치, 평소엔 위젯들이 이미 "3개+더보기" 규칙으로 내용이 제한돼 있어 스크롤이 보일 일은 거의 없음). ⑤ "오늘 뭐먹지"+"오늘 뭐하지"로 묶여 있던 위젯과 "하고싶은 말"+"장바구니"로 묶여 있던 위젯을 각각 독립 위젯 4개(`mealToday`/`scheduleToday`/`sticky`/`shopping`)로 분리 — `HomeSections`가 `flex` 세로 목록 대신 `grid grid-cols-2`(+`rectSortingStrategy`)로 4개를 자동 배치해서, 드래그로 순서를 바꾸면 어떤 2개가 같은 행(옆에 붙음)에 오고 어떤 게 다른 행(위아래로 쌓임)에 올지 자유롭게 조합됨. `resolveHomeLayout()`은 구 2위젯 체계("meal"/"board") 저장값을 감지하면 신규 4위젯 기본 배치로 폴백. `supabase/add_expense_source.sql` 신규 파일만 생성해둠(`expense.source` 컬럼, 실행은 보류 — 사용자가 직접 실행 예정) (아래 "홈 탭"/"장바구니(글로벌 시트)" 섹션 참고)

- 2026-07-11: 일정 파싱 에이전트(`agent/`)에 API 키 인증과 이미지 페이로드 제한 추가 — `main.py`에 `verify_api_key` 의존성 함수를 만들어 `AGENT_API_KEY` 환경변수가 설정된 경우에만 `X-API-Key` 헤더를 검증(불일치 시 401, 미설정이면 인증 생략)하고 `/process-schedule`/`/extract-text`에 적용(`/health`는 제외). `image_base64`는 원본 이미지 기준 약 8MB를 초과하면 413을 반환. 다만 두 엔드포인트 모두 브라우저(`BoardSection.tsx`/`AgentSheet.tsx`, 둘 다 클라이언트 컴포넌트)가 `src/lib/agentApi.ts`를 통해 에이전트 서버로 **직접** fetch하고 있어서, `AGENT_API_KEY`를 그대로 클라이언트 코드에 실어 보내면 번들에 노출되는 문제가 있었음 — 그래서 새 route handler `src/app/api/agent/process-schedule`, `/extract-text`(둘 다 `src/lib/agentServer.ts`의 `proxyAgentRequest()` 사용)를 만들어 브라우저→Next 서버→에이전트 서버로 경유하게 바꾸고, 서버 전용(접두사 없는) `AGENT_API_KEY`는 이 route handler 안에서만 읽어 `X-API-Key`로 실어 보냄. `agentApi.ts`의 `callAgent()`/`extractTextFromImage()`는 이제 에이전트 서버 URL 대신 같은 오리진의 `/api/agent/*`를 호출(타입 export는 그대로라 `ConfirmCards.tsx`는 변경 없음). `agent/.env.example` 신규 생성(그동안 파일 자체가 없었음) + `AGENT_API_KEY` 설정법을 `agent/.env.example`과 이 문서 "환경변수" 섹션에 기록

- 2026-07-11: 코드리뷰 반영 4건 — ① `completeGroceryRun`이 조회/연결 양쪽 쿼리에 `workspace_id`/`is_purchased`/`expense_id IS NULL` 필터를 추가하고, 클라이언트가 넘긴 `itemIds`가 아니라 필터링된 조회 결과만으로 expense 연결/냉장고 추가를 수행하도록 보강(필터 후 대상이 0개면 expense를 만들지 않고 `{ ok:false, message:"묶을 항목이 없어요" }` 반환). ② 사용자에게 보여야 하는 실패(정원 초과·권한 없음·유효하지 않은 워크스페이스 등)를 `throw` 대신 `{ ok:false, message }` 반환으로 통일 — 프로덕션에서는 서버 액션의 throw 메시지가 마스킹되기 때문. 대상: `joinWorkspace`, `createManagedMember`/`regenerateShareToken`, `updateNotice`/`deleteNotice`, `deleteSchedule`(호출부 없는 죽은 함수), `updateMeal` — 각 호출 컴포넌트도 반환값의 `message`를 기존 토스트/에러 표시 방식으로 노출하도록 수정. DB 에러 등 예상 밖 실패는 기존대로 `throw` 유지. ③ `supabase/add_receipt_delete_policy.sql` 신규 — `receipts`/`avatars`/`notice-images` 세 버킷 모두 본인 폴더 한정 DELETE 정책이 빠져 있어서 추가(재실행 안전한 `DROP POLICY IF EXISTS` 패턴). ④ 설정 탭 "외부 공유" 섹션에 `mirror.label` 톤으로 "링크가 있는 누구나 오늘 식탁, 공유 일정, 고정 공지를 볼 수 있어요" 안내 문구 한 줄 추가

- 2026-07-11: 게시판 상단의 전역 `+` 버튼을 없애고 유형별 개별 진입점으로 교체 — "하고싶은 말" 섹션은 스티커 가로 스크롤 끝에 점선 테두리 직사각형(스티커와 동일 크기) 추가 버튼, "메모 · 공지" 섹션은 라벨 오른쪽 `SectionLabel`의 `onAdd`로 + 아이콘(시트 안에서는 메모/공지만 선택, 하고싶은 말 옵션은 제거). 메모/공지 리스트 카드는 제목 폰트 축소(14→13px), 내용은 `line-clamp-2`→`truncate` 한 줄+`--text-muted`로 변경, 작성자·시간을 행 오른쪽으로 정렬. 상세 시트도 재구성 — 메모/공지는 "삭제하기" 텍스트 버튼을 없애고 시트 우상단 연필 아이콘(작성자만)으로 대체해 탭하면 시트 자체가 제목/내용 편집 가능한 인라인 수정 모드로 바뀌며 하단에 [삭제]/[저장]이 뜨고, 삭제는 확인 다이얼로그를 한 번 더 거침. 하고싶은 말 상세 시트는 그동안 빠져 있던 작성자 표시를 추가하고 오른쪽 끝에 좋아요(하트) 버튼을 새로 달았음(`notice_like` 신규 테이블, `meal_like`와 동일한 복합 PK + `notice_comment`와 동일한 RLS 패턴) — 스티키노트 본문 폰트도 18→16px로 한 단계 축소. 홈 화면의 "오늘 뭐먹지"/"오늘 뭐하지" 사이 세로 헤어라인은 제거 (아래 "게시판 탭" 섹션 참고)

- 2026-07-11: 일정 탭 상단을 전면 재구성 — 기존 "상태 텍스트 + 내 루틴 링크"를 24시간 도넛 차트(120px, 내 루틴 화면 것 재사용) + 현재 루틴 상태/[설정] 링크로 된 좌우 2단 `RoutineTopWidget`으로 대체(루틴 미사용 멤버는 한 줄짜리 축소 형태). 필터 영역을 뷰 탭(월간/주간/연간) 아래 "왼쪽 전체·공유·개인 / 오른쪽 대상 필터" 한 줄로 재배치(`EventFilters`, "프라이빗"→"개인" 명칭 변경)하고, 키워드 필터 칩은 달력 아래로 이동(`KeywordFilterRow` 신규). 월 네비게이션([<] 연월 [>])은 상단 중복 표시를 없애고 `MonthView` 달력 바로 위로 이동. `supabase/add_routine_enabled.sql`로 `workspace_member.routine_enabled` 컬럼 추가(내 루틴 화면에 사용 여부 토글 신규) (아래 "일정 탭" 섹션 참고)
- 2026-07-11: 게시판의 하고싶은 말/메모/공지에 **수정 기능** 추가 — 각 항목에 작성자에게만 보이는 연필 아이콘(누르면 기존 내용이 채워진 같은 작성 시트가 열리고 저장 시 `updateNotice` 호출, `addNotice`와 동일한 작성자 검증 패턴). 시트가 상시 마운트된 채 `open`만 토글되는 기존 구조라, 열릴 때마다(그리고 수정 대상이 바뀔 때마다) 필드를 다시 채우도록 `useEffect` 기반으로 리셋 로직을 변경 (아래 "게시판 탭" 섹션 참고)

- 2026-07-11: 홈을 "오늘 등록된 것만 보여주는 상태판"으로 단순화 — "오늘 뭐먹지"에 있던 빈 상태(메뉴 고르는 중/대신 골라줘/늘 먹던 걸로)와 "오늘의 제안" 위젯을 **전부 식탁 탭으로 이동**(홈은 오늘 등록된 끼니가 없으면 그냥 비움, 다음 끼니로 대체하지도 않음). "오늘 뭐하지"의 "오늘 등록된 일정이 없어요" 문구도 제거하고 빈 상태를 그냥 비워둠. 대신 **일정 탭**의 달력(`MonthView`) 하단, 선택한 날짜에 일정이 없을 때 새 "오늘 뭐하지" 활동 추천 섹션(`ActivitySuggestionSection`)을 추가 — 정적 큐레이션 활동 풀(`src/lib/activitySuggestions.ts`, 나이/취미 기반 개인화는 아직 없음)에서 날짜 시드로 하나를 보여주고, 룰렛/사다리타기로 다시 골라 고른 항목을 바로 `createSchedule`로 그날 일정에 등록할 수 있음. 룰렛(`RouletteBoard`)은 식탁 탭의 `MealDecisionSheet`에서 쓰던 것을 `src/components/ui/`로 추출해 재사용, 사다리타기(`LadderGame`, 신규)는 실제 세로줄+가로선을 생성해 경로를 추적하는 진짜 사다리타기 로직(줄 선택 → 결과 확인 중 딜레이 → 도착 칸 공개) (아래 "일정 탭"/"식탁 탭" 섹션 참고)
- 2026-07-11: "오늘 뭐먹지"를 등록 중심에서 **메뉴 결정 경험**으로 리뉴얼(식탁 탭 3차) — 빈 상태를 "메뉴 고르는 중 🤔" + [직접 등록]/[대신 골라줘] + "늘 먹던 걸로" 원클릭 칩으로 교체, `MealDecisionSheet` 신규(룰렛/이상형 월드컵/가족 투표 3모드). 가족 투표는 `meal_vote`/`meal_vote_ballot` 신규 테이블(`supabase/add_meal_vote.sql`) + `MealVoteCard`로 구현(마감은 자동이 아니라 수동, 최다득표는 등록 "제안"만 — 2026-07-11 같은 날 안에 위치가 홈 → 식탁 탭으로 바뀜, 아래 참고). "사이드" 별도 입력 필드는 제거하고 메뉴 입력에 통합 (아래 "식탁 탭" 섹션 참고)
- 2026-07-10: 장바구니를 게시판 탭에서 완전히 분리해 **어느 탭에서든 열리는 전역 바텀시트**로 재설계(진입점: 독바 5번째 버튼, 홈 미리보기 탭). 미구매 리스트+구매 완료 아카이브(날짜별 그룹) 구성에 "장보기 완료" 플로우(장소/총액/영수증 첨부 → `expense`에 `category='grocery'`로 자동 기록, "재고에 추가" 토글로 `fridge_item` 반영)를 추가. `supabase/add_shopping_expense_link.sql`로 `shopping_item.expense_id`/`expense.receipt_image_url`/`receipts` 버킷 마이그레이션 (아래 "장바구니(글로벌 시트)" 섹션 참고)
- 2026-07-10: 게시판 개선 1차 — "스티커" 명칭을 **"하고싶은 말"**로 전면 변경(홈 섹션 라벨/게시판/작성 시트), 스티키노트 디자인을 라운드 카드 → 오른쪽 아래 모서리 접힘 효과가 있는 직사각형(손글씨 폰트 `Nanum Pen Script` 적용)으로 교체, 이미지 첨부 지원(`notice.image_url` + `notice-images` Storage 버킷) 추가. 메모/공지 미리보기에서 줄바꿈이 사라지던 버그를 `whitespace-pre-wrap` 누락으로 확인해 수정. 메모/공지 작성 시 이미지 첨부 → 에이전트 서버 신규 엔드포인트 `POST /extract-text`(Gemini)로 텍스트만 추출해 내용란 자동 채우기 추가 (아래 "게시판 탭" 섹션 참고)

- 2026-07-10: 일정 파싱 에이전트에 **루틴(반복되는 하루 일과) 등록 채널** 추가 — 기존 일정 파이프라인을 확장해 같은 대화창/확인 카드 흐름에서 "일정"과 "루틴"을 함께 다룸. `ClassifyIntent` 노드(휴리스틱, LLM 호출 없음)가 입력을 일정/루틴/혼합으로 분류하고, 루틴은 요일+시간 블록으로 추출되어 `ConfirmCards`의 새 루틴 카드(요일 칩·대상 멤버·블록 인라인 수정/겹침 경고)를 거쳐 기존 `upsertRoutine` 액션으로 저장됨 (아래 "일정 파싱 에이전트" 섹션 참고)
- 2026-07-10: 식탁 탭 전체를 홈/일정 탭과 동일한 "스마트미러" 원칙으로 전환 — 주간 달력 카드 제거(오늘=honey 원형, 선택=옅은 링), 메뉴 카드를 40px 썸네일+행 스타일로 전환(카드 박스 제거), 끼니 추가 화면의 칩/입력 필드를 텍스트 토글+하단 라인(`Input`/`Textarea` 신규 `variant="underline"`)으로, 메뉴 상세의 배경 박스 제거. 김에 `CheckToggle`의 하드코딩된 미체크 배경(`#E8E6E0` → `bg-border-light`)도 다크 모드 대응하도록 수정 (아래 "식탁 탭" 섹션 참고)
- 2026-07-10: 구성원 = 로그인 계정이라는 전제를 깨고, 넷플릭스 프로필처럼 **계정 보유(account) 멤버**와 **계정 없는 관리 멤버(managed, 자녀 등)**가 공존하도록 `workspace_member`를 확장 (아래 "가족 구성원 모델" 섹션 참고). `supabase/add_managed_members.sql`로 스키마 마이그레이션 완료 — `routine`은 `user_id` → `member_id` FK로 전환(예전 컬럼은 삭제), `schedule.target_members`는 `users.id` 배열 → `workspace_member.id` 배열로 의미가 바뀌었고 기존 데이터는 백필됨. 설정 탭에 관리 프로필 추가/수정/삭제 UI 신규.
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

**가족 구성원 모델** — 2026-07-10 신규: "계정 없는 가족 구성원(자녀) 프로필"
- ✅ `workspace_member`가 두 종류의 멤버를 함께 담도록 확장됨 — `member_type`(`'account'` | `'managed'`)로 구분:
  - `account`: 기존과 동일, 로그인 계정 보유(`user_id` NOT NULL), 표시 이름은 `display_name`, 아바타는 `users.avatar_color`/`avatar_text_color`/`avatar_image_url`
  - `managed`(신규): 계정 없는 관리 멤버(자녀 등), `user_id`는 항상 NULL, 표시 이름은 새 컬럼 `name`, 아바타는 새 컬럼 `avatar_color`/`avatar_image_url`(색상만 지원 — 이미지 업로드는 이번 범위에 없음, `avatar_text_color`도 없어서 고정 대비색 `#1A1A18` 사용)
  - DB CHECK 제약으로 `account`↔`user_id NOT NULL`, `managed`↔`user_id NULL`을 강제. `UNIQUE(workspace_id, user_id)`는 `user_id IS NOT NULL`인 행에만 적용되는 partial unique index로 전환(관리 멤버는 여러 명이어도 `user_id`가 전부 NULL이라 충돌 없음)
  - 마이그레이션: `supabase/add_managed_members.sql` (실행 완료). `src/lib/members.ts`의 `mapWorkspaceMembers()`가 두 종류를 하나의 `WorkspaceMemberInfo`(`id`/`user_id`/`member_type`/`display_name`/`avatar_*`/`birth_year`)로 통일해서 반환 — 호출부는 타입을 신경 쓸 필요 없이 `display_name`/`avatar_*`만 읽으면 됨
- ✅ **식별자 전환**: `target_members`(일정 대상)와 `routine`(내 루틴)이 이제 **`users.id`가 아니라 `workspace_member.id`를 가리킴** — 관리 멤버는 로그인 계정이 없어서 `users.id`가 존재하지 않기 때문. 반대로 `meal_participation`/`meal_like`/`meal_comment`/`notice.created_by`/`schedule.author_id` 등 **"누가 실제로 로그인해서 만들었는가"에 해당하는 필드는 전부 그대로 `users.id`(실제 로그인 user_id) 기준 유지** — 관리 멤버는 로그인할 수 없으니 이런 필드의 값이 될 수 없음(의도된 설계)
  - `routine`: `user_id` 컬럼은 삭제되고 `member_id`(FK→`workspace_member.id`, `ON DELETE CASCADE`)로 대체. RLS: 내 루틴은 나만 읽기/쓰기, **관리 멤버 루틴은 같은 워크스페이스의 account 멤버 누구나 읽기/쓰기**(부모가 자녀 루틴을 등록하는 시나리오) — 단, 다른 account 멤버(배우자 등)의 루틴은 여전히 서로 비공개(기존 `own_routine` 정책의 프라이버시 원칙 유지). 헬퍼 함수 `can_read_routine()`/`can_write_routine()`(SECURITY DEFINER)
  - `schedule.target_members`: `UUID[]` 배열 안의 값이 `users.id` → `workspace_member.id`로 의미가 바뀜(기존 데이터는 마이그레이션 스크립트가 백필). `AddEventSheet`/`ConfirmCards`(에이전트)의 대상 선택 칩, `targetLabel()`(`src/lib/scheduleTargets.ts`)의 조회 키가 전부 `member.id` 기준으로 변경됨
- ✅ 루틴 화면(`/schedule/routine`)에 "누구의 루틴인가요" 멤버 선택 추가 — 기본은 나 자신, 관리 멤버를 선택하면 그 멤버의 루틴을 대신 편집(아래 "내 루틴" 섹션 참고)
- ✅ 홈 상단 "가족 전체 상태" 행에 관리 멤버도 동일하게 루틴 기반 상태로 표시됨
- ✅ 설정 탭 "가족 구성원" 목록에 "구성원 추가" 버튼(신규 `ManagedMemberSheet`) — 이름/아바타 색상/출생연도(선택) 입력. 관리 멤버는 목록에서 "관리 프로필" 뱃지로 구분되고 연필 아이콘으로 수정 가능. 삭제 시 확인 다이얼로그에서 "루틴은 함께 삭제되고, 이 멤버를 대상으로 지정했던 일정은 남지만 더 이상 특정 대상으로 표시되지 않는다"는 점을 명시(스키마 상 `routine.member_id`는 CASCADE지만 `schedule.target_members`는 배열이라 FK 연쇄 삭제가 되지 않기 때문)
- ✅ `member_limit`(가족 정원) 카운트는 `workspace_member` 전체 행 수를 그대로 세므로 관리 멤버도 자동으로 포함됨(`joinWorkspace`/`createManagedMember` 둘 다 동일 카운트 로직)
- 게시판/식탁 탭의 "작성자" 개념은 이번 리팩토링과 무관 — 여전히 로그인한 실제 사용자 기준으로만 동작(관리 멤버는 게시판 글도, 끼니도 만들 수 없음)

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
- ✅ 오늘 뭐먹지 + 오늘 뭐하지 — 2026-07-09부터 **좌우 2단으로 통합**(기존엔 "오늘 뭐하지 + 지금 우리 가족은"이 2단이었음). 메뉴명 폰트도 22→17px로 축소(2단이 되며 폭이 좁아진 데 맞춤). 2026-07-11부터 이 둘은 코드상 서로 다른 독립 위젯(`HomeMealSection`/`HomeTodaySection`)이고, 홈 위젯 순서 커스터마이징(아래 참고)의 기본 배치가 이 둘을 나란히 두기 때문에 시각적으로는 그대로 2단처럼 보임 — 드래그로 순서를 바꾸면 서로 떨어질 수도 있음
  - 오늘 뭐먹지: 가로 스와이프 캐러셀(스크롤바 숨김, `.scrollbar-hide`), 오늘 등록된 끼니 전부 시간순 정렬 + "태그·타입" 보조줄 + "+ 사이드·참여자 이름" 보조줄. 점 인디케이터는 활성 시 honey 색 길쭉한 필
  - 오늘 뭐하지: 각 행 순서가 2026-07-09부터 `[제목(말줄임)] [시간/종일 배지(honey, tabular-nums, bg-honey/10 pill)] [대상(옅게)]`로 변경(이전엔 시간이 맨 앞이었음). 오늘 일정만 최대 3개 표시하고 초과 시 "더보기"(`/schedule`로 이동)
- ✅ 2026-07-09 섹션별 빠른 추가 — "오늘 뭐먹지"/"오늘 뭐하지"/"스티커"/"장바구니" 라벨 줄 오른쪽 끝에 44px 탭 영역의 `+` 아이콘(배경/테두리 없음, `--text-muted`) 배치, 탭하면 바텀시트가 바로 열려 추가 가능(전용 페이지 이동 없음):
  - 끼니: 신규 `MealQuickAddSheet.tsx`(태그/유형/메뉴/사이드/메모, `createMeal` 재사용) — 홈 전용 경량 버전, 재고 확인 등 `AddMealScreen`의 부가 기능은 뺌
  - 일정: 기존 `AddEventSheet.tsx`(일정 탭과 동일 컴포넌트) 그대로 재사용
  - 스티커: `BoardSection.tsx`의 `AddPostSheet`를 export해 재사용 — `fixedType="sticky"` prop을 주면 타입 선택 UI 자체를 숨기고 스티커 고정
  - 장바구니: 2026-07-11부터 전용 빠른 추가 시트 없이 `GlobalShoppingSheet`를 그대로 엶(아래 "장바구니(글로벌 시트)" 참고, 예전엔 별도 `ShoppingQuickAddSheet.tsx`가 있었으나 + 버튼과 리스트 클릭이 서로 다른 시트를 여는 중복이라 삭제하고 통일함)
  - 이 4개 + 버튼을 지원하려고 `SectionLabel`에 옵션 prop `onAdd`/`addLabel` 추가(지정 안 하면 기존처럼 라벨만 표시, 하위 호환)
- ✅ 하고싶은 말 / 장바구니 — 2026-07-11부터 각각 독립 위젯(`HomeStickySection`/`HomeShoppingSection`, 예전엔 `BoardPreview.tsx` 하나가 좌우 2열로 둘 다 그렸음 — 위젯 4분할하며 분리 후 `BoardPreview.tsx` 삭제). 하고싶은 말은 작성자+내용+D-N(전부 흐림/작게, `/board`로 링크), 장바구니는 3px sage 도트+이름(4개+"외 N개") — 둘 다 탭하면 해당 시트가 열림
- ✅ 태블릿(lg: 1024px~) 3단 컬럼 — `grid-cols-mirror`(1fr 1.4fr 1fr) 토큰, 좌: 헤더 정보(세로 중앙) / 중: 끼니+오늘 2단 통합 / 우: 하고싶은말+장바구니 2단 통합, 컬럼 사이 헤어라인. 이 3단 배치는 `home/page.tsx`가 4개 위젯 컴포넌트를 태블릿 전용으로 직접 조합한 것이라 드래그 순서 변경 대상이 아님(모바일 전용 기능). 모바일은 그대로 세로 스택
- ✅ 여백/색상 전부 토큰화: `tailwind.config.ts`의 `spacing.section`(30px)/`label-gap`(12px)/`row`(7px), `src/lib/homeTheme.ts`의 `mirror.*` (CSS 변수 참조 클래스 모음) — 하드코딩 없음
- ✅ 섹션 라벨(오늘 뭐먹지/오늘 뭐하지/스티커/장바구니) 앞에 14px 픽토그램 아이콘 (`SectionLabel` 공용 컴포넌트, `mirror.label` 색 그대로 상속)
- ✅ 섹션 내용 들여쓰기 — 라벨의 [아이콘 14px + gap-1.5(6px)]과 내용 시작점을 맞추기 위해 `--section-indent`(20px) 토큰, `pl-section-indent`로 홈 섹션 콘텐츠 래퍼에 공통 적용
- ✅ 텍스트 말줄임(ellipsis) 버그 수정 — flex 행 안의 `truncate` span이 `min-w-0` 없이 `flex-1`(혹은 아무 크기 지정도 없이)만 있으면 브라우저 기본값(`min-width: auto`)때문에 실제로는 잘리지 않고 밀려나가는 문제가 있었음. 홈/일정 탭 리스트 전반에 `min-w-0 flex-1` 조합을 일괄 적용 (`DEBUG_LOG.md` 참고)
- ✅ 홈 섹션 순서 커스터마이징(모바일 전용, 태블릿 3단 쇼케이스는 대상 아님) — 드래그 가능한 위젯 개수 변천: 3개(2026-07-08) → 2개(2026-07-09, `meal`/`board` 통합 위젯) → **2026-07-11부터 4개로 재분할**: `mealToday`(오늘 뭐먹지)/`scheduleToday`(오늘 뭐하지)/`sticky`(하고싶은 말)/`shopping`(장바구니), 각각 완전히 독립된 단위. 섹션을 500ms 길게 누르면 편집 모드 진입(전체 섹션 `scale-0.97` + 각 섹션 왼쪽에 `IconGripVertical` 핸들 노출), 핸들을 드래그하면 `@dnd-kit/core`+`@dnd-kit/sortable`로 순서 변경.
  - 2026-07-11부터 컨테이너가 세로 `flex` 목록이 아니라 `grid grid-cols-2`(+ `rectSortingStrategy`, 2D 그리드용 dnd-kit 정렬 전략)로 바뀌어 4개 위젯이 2행×2열에 자동 배치됨 — 드래그로 순서를 바꾸면 어떤 2개가 같은 행에 나란히 붙고 어떤 게 다른 행으로 쌓일지 자유롭게 조합 가능(고정된 쌍이 없음). 행 사이(2번째 다음)에만 전체 폭 헤어라인 표시
  - 편집 모드 종료는 빈 곳 탭 또는 상단 "완료" 버튼. 순서는 낙관적으로 즉시 반영되고, 서버 액션(`updateHomeLayout`, `home/actions.ts`)으로 `users.home_layout`(JSONB 배열, 예: `["mealToday","scheduleToday","sticky","shopping"]`)에 저장 — 저장 실패해도 화면 순서는 그대로 유지하고 토스트만 띄움
  - 페이지 로드 시 `resolveHomeLayout()`(`src/lib/homeLayout.ts`)이 저장값에서 알려진 섹션 id만 남기고, 새로 추가될 미래 섹션은 자동으로 뒤에 이어 붙임(값이 없으면 기본 순서). **2026-07-11 마이그레이션**: 구 2위젯 체계("meal"/"board" 문자열)로 저장된 값은 새 4개 id와 아예 달라 이어붙일 수 없으므로, 감지되면 그냥 기본 배치(`mealToday, scheduleToday, sticky, shopping`)로 폴백함. 컴포넌트: `src/components/home/HomeSections.tsx`
  - `supabase/add_home_layout.sql`(`users.home_layout JSONB` 컬럼 추가)을 라이브 DB의 SQL Editor에서 실행해야 순서 저장이 동작함 (미실행 상태면 조회는 되지만 항상 기본 순서만 나오고, 저장 시도 시 컬럼 없음 에러가 날 수 있음)
- ✅ 2026-07-11 **한 화면 고정(100dvh, 모바일)** — 홈 페이지 바깥 컨테이너를 `h-[calc(100dvh-64px)]`(64px = 독바 높이) + `overflow-hidden`으로 고정해 페이지 자체(`body`/document)는 절대 스크롤되지 않게 함. 안쪽은 세로 flex: 헤더(히어로+가족 상태, 고정 높이)+헤어라인은 그대로 두고, 위젯 그리드를 담은 마지막 자식만 `min-h-0 flex-1 overflow-y-auto`로 남은 높이를 전부 차지 — 컨텐츠가 넘치면 그 영역 안에서만 스크롤되고 헤더/독바는 항상 고정. 평소엔 각 위젯이 이미 "리스트 최대 3개+더보기"/`truncate` 원칙으로 내용이 제한돼 있어 스크롤이 실제로 나타날 일은 거의 없음. **엣지 케이스(위젯 4개가 좁은 화면 등에서 사실상 세로로 길게 쌓이는 경우)**: `grid-cols-2` 자동 배치라 화면 폭이 있는 한 항상 2행×2열로만 배치되므로(4개 고정이라 드래그로도 "4개가 한 줄씩 세로로" 형태는 나오지 않음) 실사용 중 발생 가능성은 낮지만, 혹시라도 폰트 확대(접근성 설정) 등으로 실제 필요 높이가 뷰포트를 넘으면 위 `overflow-y-auto` 안전장치가 그 영역만 스크롤시켜 흡수함 — 페이지 스크롤이나 독바 겹침으로 이어지지 않음

**프로필 이미지** — 2026-07-07 신규
- ✅ `users.avatar_image_url` 컬럼 + Supabase Storage `avatars` 버킷(퍼블릭 읽기, 본인 폴더만 쓰기) 추가
- ✅ 설정 탭에 업로드 UI (`AvatarUploader`) — 파일 선택 시 브라우저에서 Storage에 직접 업로드 후 서버 액션으로 `avatar_image_url` 갱신, "기본 이미지로 되돌리기" 지원
- ✅ `Avatar` 컴포넌트가 `imageUrl` prop을 받으면 이미지로, 없으면 기존 이니셜로 폴백. 끼니상세·카드/설정 등 아바타 노출 지점에 반영 (홈 화면은 "스마트미러" 재구성으로 원형 아바타 대부분 제거 — 헤더의 작은 아바타만 남음)

**식탁 탭**
- ✅ 주간 달력 + 메뉴 카드
- ✅ 끼니 추가 전체화면
- ✅ 메뉴 상세 + 댓글 — 2026-07-07 하트(즐겨찾기) 버튼을 체크(참여) 버튼 옆으로 이동
- ✅ 2026-07-10 홈/일정 탭과 동일한 "스마트미러" 원칙으로 전환(카드/배경 박스 제거):
  - 주간 달력(`WeekCalendar`) — 카드 배경 제거, 일정 탭 `MonthView`와 동일한 방식으로 **오늘**은 honey 원형(`bg-honey/15`), 클릭해서 고른 날짜는 옅은 링(`ring-honey/40`)으로 구분. 등록 여부 도트는 유지. 달력 아래 헤어라인으로 리스트와 구분
  - 메뉴 카드(`MealCard`) — 카드 박스 제거, 행 스타일로 전환: `[40px 썸네일/이모지] [끼니(honey)·유형(sage) 태그] [메뉴명 15px --text-primary + 사이드 12px --text-secondary] [참여자 아바타 18px]`, 우측에 하트/참여 체크. 끼니 목록은 `divide-y`로 헤어라인만 구분(카드 gap 제거). 기존 타입별(집밥/외식/배달) 개별 색상 매핑은 제거하고 유형은 전부 sage로 통일
  - 끼니 추가 화면(`AddMealScreen`) — 끼니/식사 유형 칩을 배경 pill에서 텍스트 토글(선택: `text-ink`, 비선택: `--text-muted`)로 전환, 메뉴 추천 칩도 동일하게 텍스트만. 장소/시간/메뉴/사이드/메모 입력은 `Input`/`Textarea`의 신규 `variant="underline"`(박스 테두리 대신 하단 라인만, `--input-*` 변수 재사용)로 전환. "현재 재고 확인" 링크는 `text-honey`(accent)로, 등록하기 버튼은 `--btn-surface-bg`/`-text` 쌍으로 전환. 섹션 라벨은 홈과 동일한 10px letter-spacing 스타일(`mirror.label`)
  - 메뉴 상세(`MealDetail`) — 장소 링크, 참여/좋아요 바의 배경 박스(`border` + `bg-surface`) 제거하고 헤어라인/여백만 남김. 태그 색상도 카드와 동일하게 끼니=honey/유형=sage로 통일. 사진 히어로 영역과 댓글 입력창(폼 컨트롤)은 카드가 아니라 실제 콘텐츠/입력 위젯이라 그대로 유지
  - 식탁/일정 탭 플로팅 `+` 버튼은 이미 `bg-ink`/`text-cream`(둘 다 CSS 변수 기반 토큰)를 쓰고 있어 다크에서 흰 배경+어두운 아이콘, 라이트에서 어두운 배경+흰 아이콘이 되는 것을 확인 — 두 탭 모두 동일한 클래스라 추가 변경 없이 요구사항 충족
  - 공용 `components/ui/Input.tsx`에 `variant` prop(`"boxed"`(기본) | `"underline"`) 추가, `components/ui/CheckToggle.tsx`의 미체크 배경을 하드코딩 `#E8E6E0` → `bg-border-light`(`--hairline`)로 수정(다크 모드에서 안 바뀌던 버그)
- ✅ 2026-07-11 "오늘 뭐먹지" 리뉴얼 — 등록 중심에서 메뉴 결정 경험으로 확장. **결정/추천 UI는 식탁 탭 전용**(같은 날 안에 홈에도 잠깐 뒀다가 바로 식탁 탭으로 옮김 — 홈은 "오늘 등록된 것만" 보여주는 상태판이라는 원칙으로 정리):
  - 빈 상태(`MealEmptyState.tsx`, `src/components/food/`) — "등록된 끼니가 없어요" → "메뉴 고르는 중 🤔" + **[직접 등록]**(`/food/add`로 이동) / **[대신 골라줘]**(아래 `MealDecisionSheet` 오픈). 과거 `meal` 기록(최근 200개)에서 `getFrequentMenus()`(`src/lib/mealUtils.ts`)로 집계한 상위 3개 메뉴를 "늘 먹던 걸로" 칩으로 제시 — 탭하면 바로 `createMeal` 호출(원클릭 등록, 화면 이동 없음). 식탁 탭에서만 쓰고, 홈의 `MealSummaryCard`는 끼니가 없으면 그냥 아무것도 렌더링하지 않음(`return null`)
  - `MealDecisionSheet.tsx`(`src/components/food/`) — 모드 3개를 탭으로 전환:
    - **룰렛** — 후보 8개(자주 먹은 메뉴 + `DEFAULT_MENU_POOL` 기본 풀로 채움, `buildCandidatePool()`)를 그리드로 보여주고 하이라이트가 점점 느려지며 한 곳에 멈추는 방식으로 연출(진짜 물리 애니메이션이 아니라 `setTimeout` 체인으로 하이라이트 인덱스를 감속시키며 이동). 결과 후 [이걸로 등록]/[다시]. 이 룰렛 UI는 `src/components/ui/RouletteBoard.tsx`로 추출해 일정 탭의 활동 추천에서도 재사용
    - **이상형 월드컵** — 같은 8개 후보로 8강→4강→결승 단일 토너먼트(승자만 다음 라운드로), 우승 메뉴 [등록]/[다시하기]
    - **가족 투표** — 후보 2~4개 입력 후 "투표 시작하기" → `createMealVote`가 `meal_vote` 행 하나를 생성(이미 진행 중인 투표가 있으면 생성 UI 대신 안내만 표시). 실제 투표 UI(`MealVoteCard.tsx`, 식탁 탭 전용)에서 가족 구성원이 후보를 탭해 `castMealVoteBallot`(멤버당 1표, upsert)으로 투표하고 실시간 득표수를 봄. 마감 시각을 자동으로 판정하는 백그라운드 잡이 없어 **누구나 "마감하고 결과보기"를 눌러 수동으로 마감**하는 방식으로 대체 — 마감되면 최다득표 메뉴 + "이 메뉴로 등록" 버튼(자동 등록 아님, 확인 후 등록) 표시
    - 마이그레이션: `supabase/add_meal_vote.sql` — `meal_vote`(workspace_id/date/candidates TEXT[]/deadline/is_closed) + `meal_vote_ballot`(vote_id, user_id, candidate_index, `UNIQUE(vote_id,user_id)`) 신규 테이블, RLS는 기존 `is_workspace_member()` 헬퍼 재사용
  - **"오늘의 제안"** 카드 캐러셀(`SuggestionSection.tsx`, `src/components/food/`) — 식탁 탭 페이지 하단에 상시 노출(끼니 등록 여부와 무관). 가로 스와이프 카드 4장: 늘 먹던 메뉴 / 룰렛 바로가기("메뉴 랜덤 고르기", 탭하면 `MealDecisionSheet` 룰렛 모드로 바로 오픈) / 주말 활동 제안(`WEEKEND_ACTIVITY_POOL` 정적 큐레이션 풀에서 날짜 문자열을 시드로 결정론적으로 하나 선택, `pickDeterministic()`을 `src/lib/randomPick.ts`로 공용 추출) / 추천 레시피(자리만, "서비스 준비중", P2 — 2026-07-11 문구 축약, 예전엔 "냉장고 재고 추천"/"준비 중이에요"). 홈의 위젯 순서 변경 시스템(`HomeSectionId`)에는 더 이상 포함되지 않음
  - `AddMealScreen.tsx`에서 "사이드 (선택)" 입력 필드 제거 — 이제 사이드도 "메뉴" 입력 한 줄에 쉼표로 함께 적음. 기존에 저장된 `sides` 데이터는 `MealCard`/`MealDetail`에서 표시만 계속 되고(하위 호환), 수정 화면에서도 기존 값을 그대로 보존만 함(더 이상 편집 UI는 없음)
  - ✅ 2026-07-11 **끼니 이미지 삽입** — "메뉴" 입력란 왼쪽 끝 카메라 아이콘을 탭하면 `meal-images` 버킷(신규, `supabase/add_meal_image.sql`)에 브라우저 직접 업로드 → 아이콘이 작은 썸네일로 바뀌고 옆에 제거(x) 버튼 노출. `meal.image_url` 컬럼 자체는 스키마에 원래 있었고 `MealCard`/`MealDetail`도 이미 "image_url 있으면 썸네일, 없으면 emoji" 조건부 렌더링을 갖추고 있었음 — 이번에 등록/수정 화면에 업로드 UI만 새로 연결한 것. `MealInput`(`food/actions.ts`)에 `image_url` 필드 추가해 `createMeal`/`updateMeal` 양쪽에 반영

**일정 탭**
- ✅ 월간 / 주간 / 연간 뷰 — 2026-07-07 월 라벨("2026년 7월") + 이전/다음 달 이동 버튼 추가(2026-07-11부터 `MonthView` 달력 바로 위로 위치 이동, 아래 참고)
- ✅ 일정 등록 — 2026-07-07 종일 토글, 공유 대상 라벨("가족 전체"/"개인"), 준비물+메모 통합, 사진 URL, 알림 옵션(당일 오전/하루 전/일주일 전/직접 설정) 추가
- ⚠️ 2026-07-12 **반복 일정(데이터 레이어만)** — `AddEventSheet`에 "반복"(없음/매월/매년, 매년 선택 시 양력·음력 토글) 추가. `schedule.recur_type`/`recur_calendar`/`recur_until`(`supabase/add_schedule_recurrence.sql`, 실행 필요) + `src/lib/lunar.ts`(`Intl 'ko-u-ca-dangi'` 기반 음력 변환) + `src/lib/recurrence.ts`(`expandRecurring` — 저장 없이 화면에 보여줄 범위만큼만 가상 인스턴스 계산) + `getSchedulesForRange`(`schedule/actions.ts`, 월간/연간 뷰에서 원본+가상 인스턴스를 합쳐 반환, 주간 뷰는 이번 범위 제외)까지만 구현됨 — **수정 화면(가상 인스턴스를 열었을 때의 안내/원본 라우팅, "이번 회만 수정")은 다음 작업에서 구현 예정**, `updateSchedule` 액션 자체가 아직 없음 (아래 "반복 일정" 섹션 참고)
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
- ✅ 2026-07-11 "오늘 뭐하지" 활동 추천(`ActivitySuggestionSection.tsx`) — `MonthView`에서 선택한 날짜에 일정이 없을 때("일정이 없어요" 문구 아래) 노출. 정적 큐레이션 풀(`src/lib/activitySuggestions.ts`, 영화·드라마 보기/캠핑/보드게임 등 — 나이·취미 기반 실제 개인화는 아직 없음, 향후 과제)에서 날짜 시드로 하나를 기본 제안하고, "다른 추천 골라보기"를 누르면 룰렛(`RouletteBoard`, 식탁 탭과 공용) 또는 사다리타기(`LadderGame`, 신규)로 다시 고를 수 있음. 고른 항목은 `createSchedule`로 그날 종일 일정으로 바로 등록(가족 전체 공유, 강조 아님)
  - `LadderGame`(`src/components/ui/`) — 실제 사다리타기 로직: 후보 수만큼 세로줄 + 8개 행에 무작위 가로선(같은 행에서 겹치지 않게 한 칸씩 건너뜀)을 생성해두고, 사용자가 세로줄 하나를 고르면 가로선을 따라 내려가는 경로를 계산해 도착 칸을 알려줌(약 0.7초 "결과 확인 중" 딜레이 후 공개)
- ✅ 2026-07-11 상단 영역 전면 재구성:
  - **내 루틴 위젯**(`RoutineTopWidget.tsx`, 신규) — 기존 "상태 텍스트 한 줄 + 내 루틴 링크"를 대체. 좌: `RoutineWheel`을 120px로 축소 재사용(원래 내 루틴 화면 전용 220px 고정이었던 걸 `size` prop으로 비율 유지한 채 크기 조절 가능하게 리팩터링), 우: 현재 루틴 상태를 크게(`{이모지} {라벨} · {시작}~{종료}`), 현재 활성 블록이 없으면 🫧만, 아래 [설정] 링크(`/schedule/routine`). 루틴 미사용(`workspace_member.routine_enabled=false`)이면 도넛 없이 "루틴을 설정하면 내 하루가 여기 표시돼요" 한 줄 + [설정하기]로 축소 — `supabase/add_routine_enabled.sql`로 컬럼 추가(멤버별 UPDATE는 기존 `member_update` RLS로 이미 허용되어 있어 RLS 변경 불필요), 토글 UI는 내 루틴 화면(`RoutineEditor.tsx`) 상단에 "일정 탭 상단에 내 루틴 표시" 스위치로 추가(멤버 선택에 따라 값이 바뀜)
  - **필터 재배치** — 뷰 전환 탭(`ScheduleTabs`)은 이제 월간/주간/연간 탭만 담당(상태 텍스트·내 루틴 링크·월 네비게이션 전부 제거, 각각 다른 곳으로 이동). `EventFilters`는 한 줄로: 왼쪽 전체·공유·개인(**"프라이빗"→"개인"** 명칭 변경, URL 파라미터 값 `private`는 그대로 유지), 오른쪽 "대상 필터 ∨" 토글(펼치면 아래에 멤버 칩). 키워드 필터(공휴일/여행/행사/교육/건강/기타)는 `EventFilters`에서 분리해 `KeywordFilterRow.tsx`(신규, 월간 뷰 전용)로 옮기고, 예전에 두 번의 개별 `router.push`로 나뉘어 있던 "키워드 대분류 해제 시 서브도 같이 해제" 로직을 한 번의 `URLSearchParams` 업데이트로 합쳐 - 순차 `push` 때문에 서브 키워드만 지워지고 대분류는 안 지워지던 기존 버그도 함께 고침
  - **월 네비게이션 이동** — `ScheduleTabs`에 있던 `[<] 연월 [>]`를 `MonthView` 달력 그리드 바로 위로 이동(상단에 있던 중복 표시는 제거). 최종 `MonthView` 내부 순서: 월 네비게이션 → 달력 그리드 → 헤어라인 → `KeywordFilterRow` → 선택일 일정 리스트(공휴일 라벨/빈 상태·활동 추천은 그대로 리스트 자리에 유지)

**반복 일정** (기념일·생신·연간행사) — 2026-07-12 신규, **데이터 레이어만**(화면은 다음 작업)
- ✅ 스키마 — `schedule.recur_type`('none' 기본 | 'monthly' | 'yearly'), `recur_calendar`('solar' 기본 | 'lunar', yearly에서만 의미 있음), `recur_until`(DATE, NULL=무기한). **weekly는 없음** — 매주 반복은 routine(내 루틴)이 전담. 마이그레이션: `supabase/add_schedule_recurrence.sql`(실행 필요) — 컬럼만 추가라 별도 GRANT는 불필요함을 확인(새 테이블/정책이 아니므로 기존 `schedule` 테이블 권한에 자동 포함)
- ✅ 음력 변환(`src/lib/lunar.ts`) — 외부 라이브러리 없이 `Intl.DateTimeFormat('ko-u-ca-dangi')`(단기력)만 사용. `solarToLunar(date)`→`{month,day,isLeap}`, `lunarToSolarInYear(year,month,day)`→그 양력 연도 안에서 역으로 찾은 날짜(연도별 365/366일 순회 결과를 메모이제이션). 실제 Node ICU로 확인해보니 dangi 캘린더의 연도 파트가 `year`가 아니라 `relatedYear`로 나와서 지원 여부 판별을 그에 맞게 수정했고, 윤달은 "윤6"처럼 표기됨을 확인해 숫자 추출+"윤" 포함 여부로 파싱. 그 달이 작은달이라 음력 30일이 없으면 29일로 폴백. dangi 미지원 런타임이면 null(표기·전개 생략)
- ✅ 가상 전개(`src/lib/recurrence.ts`) — `expandRecurring(schedules, rangeStart, rangeEnd)`: monthly는 매월 같은 일(없는 달은 말일 클램프), yearly+solar는 매년 같은 월일(2/29→평년엔 2/28), yearly+lunar는 원본의 음력 월일을 한 번 구해두고 연도별로 `lunarToSolarInYear`. `recur_until` 이후는 중단, 원본 자신의 날짜는 다시 만들지 않음(원본은 별도 조회로 이미 나옴). 반환 인스턴스 = 원본 필드 복사 + 합성 `id`(`{원본id}__{날짜}`) + `isVirtual: true`/`originalId`. 기간(멀티데이) 일정은 시작~종료 간격을 유지한 채 이동. 월간 클램프/윤년/음력 왕복/`recur_until`/기간유지/중복없음 6가지 시나리오를 Node로 직접 실행해 검증
- ✅ 조회(`getSchedulesForRange`, `schedule/actions.ts`) — 월간/연간 뷰에서 ① 범위 내 원본 조회 ② `recur_type != 'none'`이고 아직 끝나지 않은(`recur_until` 없음 또는 범위 시작 이후) 원본들을 `expandRecurring`으로 전개, 둘을 합쳐 날짜순 정렬해 반환. 두 조회 다 기존과 동일한 "공유거나 내가 만든 것만" 가시성 필터 유지(RLS가 아니라 앱 코드 책임인 기존 규칙 그대로). `schedule/page.tsx`의 인라인 쿼리를 이걸로 교체 — **주간 뷰는 이번 범위에서 제외**(기존처럼 원본만 조회). `ExpandedSchedule`가 `Schedule`에 옵셔널 필드만 얹은 타입이라 `MonthView`/`WeekView`/`YearView`는 prop 타입 변경 없이 그대로 받음
- ✅ 등록 폼(`AddEventSheet`) — "반복" pill(없음 기본/매월/매년), 매년 선택 시에만 양력/음력 토글(기본 양력) 노출 → `createSchedule` 호출 시 함께 전달
- ⚠️ **다음 작업으로 이연**: `AddEventSheet`는 여전히 신규 등록 전용이라(`updateSchedule` 액션 자체가 없음) 가상 인스턴스 편집은 아직 불가능. 다음에 구현할 것 — 가상 인스턴스를 열면 "원본을 수정합니다" 안내 표시, 저장/삭제는 `originalId`로 라우팅, "이번 회만 수정"(단일 인스턴스 예외)은 P2로 미루고 우선은 `recur_until`로 원본을 끊고 새 반복을 만드는 우회만 지원 — `AddEventSheet.tsx` 상단에 이 취지의 코드 주석 남겨둠

**내 루틴** (`/schedule/routine`, `RoutineEditor.tsx`) — 2026-07-09 전면 재설계 (카드/블록 제거, 홈과 동일한 헤어라인 기반)
- ✅ 24시간 도넛형 차트(`RoutineWheel.tsx`, 신규) 신규 도입 — 화면 상단에 보기 전용 SVG 시각화. 자정이 12시 방향, 시계 방향으로 24시간. 등록된 시간 블록을 상태별 파스텔 색 아크로 표시, 중앙에 현재 시각(`HH:MM`) + 현재 시각 방향을 가리키는 바늘(honey), 0/6/12/18시 위치에 작은 눈금. 아크를 탭하면 해당 블록이 확대·강조되고 아래 리스트에서도 같은 블록이 강조됨(리스트 행을 탭해도 동일하게 동작) — 차트 자체는 드래그로 편집하지 않음(값은 아래 폼으로만 변경)
  - 자정을 넘기는 블록(예: 21:30~07:30 취침)도 지원 — 종료 시각이 시작 시각보다 이르면 24시를 더해 하나의 연속 아크로 그림(SVG `A` 커맨드의 large-arc-flag를 실제 경과각도 기준으로 계산해서 자정을 가로질러도 정확히 그려짐)
  - 상태별 색상은 `src/lib/routineColors.ts`(`STATUS_COLOR_VAR`)가 `globals.css`의 `--routine-work`/`-class`/`-exercise`/`-study`/`-rest`/`-sleep`/`-commute`/`-custom` 8개 변수(라이트=파스텔, 다크=톤 다운된 파스텔)로 매핑 — 블록 추가 폼의 상태 칩도 선택 시 같은 색을 배경으로 써서 차트와 일관되게 연결
- ✅ 요일 다중 선택으로 재설계 — 상단 요일 칩(월~일)은 유지하되 이제 **중복 선택 가능**(탭할 때마다 토글, 최소 1개는 항상 선택 상태 유지). 선택 순서를 배열로 추적해 **마지막으로 선택한 요일**을 차트/블록 리스트가 보여주는 "기준 요일"로 삼음(먼저 선택해 둔 다른 요일은 진하기가 옅은 강조로만 구분)
  - "블록 추가" 시 현재 선택된 **모든** 요일에 동시 적용(각 요일의 로컬 상태에 같은 블록을 추가) — 기존에 있던 "다른 요일에 복사" 섹션은 이 다중 선택으로 완전히 대체되어 **제거**됨
  - 좌우 스와이프(`onTouchStart`/`onTouchEnd`, 40px 임계값)로 기준 요일을 월→화→...→일→월 순으로 이동 — 스와이프는 항상 해당 요일 **단일 선택**으로 초기화됨(다중 선택은 칩을 직접 탭할 때만 유지/누적)
- ✅ 학기(기본/여름학기/겨울학기) 버튼 UI 제거 — `routine.semester` 컬럼 자체는 그대로 두고, 코드에서 항상 `'default'`로 고정 저장(`SEMESTER` 상수). 예전에 여름/겨울학기로 저장된 데이터가 있다면 이 화면에서는 더 이상 보이지 않음(의도된 단순화)
- 저장 로직 자체(요일별 `blocks` JSONB, `upsertRoutine` 서버 액션)는 기존과 동일 — "저장하기" 버튼을 눌러야 반영되며, 다중 선택된 요일이면 선택된 요일 수만큼 `upsertRoutine`을 반복 호출
- ✅ 2026-07-10: "누구의 루틴인가요" 멤버 선택 추가 — 기본값은 나 자신, 같은 워크스페이스의 managed 멤버(자녀 등)를 선택하면 그 멤버의 루틴을 대신 편집(다른 account 멤버는 선택지에 아예 안 나옴 — RLS가 애초에 막고 있어서). 멤버를 바꾸면 요일 선택/하이라이트 상태가 초기화됨. `upsertRoutine(memberId, day, semester, blocks)`로 시그니처 변경(예전엔 항상 로그인한 나 자신 기준)

**일정 파싱 에이전트** (`agent/`, 플로팅 대화창) — 2026-07-08 신규, 같은 날 오후 **일정 탭 전용으로 범위 축소**
- ✅ 2026-07-08: 노출 범위를 모든 탭 → **일정 탭에서만** 노출로 변경(`(main)/layout.tsx`가 아니라 `schedule/page.tsx`에서 직접 렌더). 위치도 기존 "+" 버튼(`bottom-[84px]`) 바로 위(`bottom-[148px]`, 이전 `AiAssistButton` 플레이스홀더가 있던 자리 그대로 재사용)로 세로 배치
- ✅ 2026-07-08: 스타일을 불투명 honey 원형 → "반투명 유리" 느낌으로 변경 — `bg-honey/10` + `backdrop-blur-md` + `border-honey/30`(1px), 아이콘은 honey 원색 유지. 크기도 52px → 44px(`AGENT_BUTTON_SIZE`, `+` 버튼 56px보다 살짝 작게)로 축소
- ✅ 버튼이 받는 멤버 목록 타입을 `WorkspaceMemberInfo`(아바타 필드 포함) → `AgentMemberOption`(`user_id`/`display_name`만, `src/lib/agentApi.ts`)으로 축소 — `ConfirmCards`/`AgentSheet`가 실제로 쓰는 필드만 남겨서, 스케줄 탭처럼 아바타 정보가 없는 멤버 목록도 그대로 넘길 수 있게 함
- ✅ 탭하면 화면 78% 높이 바텀시트 대화창(`AgentSheet`)이 슬라이드업 (동작 자체는 변경 없음). 핸들바를 위로 드래그하면 풀스크린, 아래로 드래그하거나 X를 누르면 닫힘
- ✅ 입력: 텍스트 직접 입력 또는 이미지 첨부(카메라 촬영/갤러리, `<input type=file accept=image/*>` 하나로 둘 다 선택 가능) → base64로 변환해 에이전트 서버에 전송. 마이크 버튼은 자리만 있고 비활성(P0-B 음성 입력 자리)
- ✅ 에이전트 서버(`agent/`)는 Next.js 앱과 완전히 분리된 Python FastAPI 서비스: LangGraph로 Plan(입력 종류 판별) → ClassifyIntent(일정/루틴/혼합 판별, 2026-07-10 신규) → Execute(Gemini 2.5 Flash로 의도에 맞는 정보 추출) → 여러 일정(이미지 속 표·목록)이면 RefineRoutine으로 직행, 단일이면 RefineSchedule(날짜 없으면 `interrupt`로 되물음) → RefineRoutine(루틴 블록 시간이 전부 비어있으면 `interrupt`로 되물음) → Finalize. **파일/DB에 아무것도 저장하지 않음** — 파싱 결과만 반환
- ✅ 응답 스키마: 일정은 Fridge `schedule` 테이블과 동일한 필드(`title/date_start/date_end/time_start/time_end/supplies/memo/keyword_main/keyword_sub/is_important/target_hint`), 루틴은 `{days:[0~6], blocks:[{start,end,status,label,memo}]}`. 완료 시 `{status:"ok", schedules:[...], routines:[...], target_hint}`, 날짜/시간 등 정보가 부족하면 `{status:"need_input", message, thread_id}`를 반환 — 클라이언트는 같은 `thread_id`와 사용자의 텍스트 답변(`user_reply`)으로 다시 요청해 재개(resume)함. 이미지 첨부는 항상 새 요청으로 취급(재개 대상 아님), 루틴은 텍스트 입력만 지원
- ✅ 확인 카드(`ConfirmCards`) — 채팅 흐름 안에 가로 스와이프 카드로 인라인 렌더. 카드마다 키워드 태그, 순번(n/N), 제목(인라인 수정), 날짜/시간/준비물/메모, `target_hint`로 미리 선택된 가족 구성원 칩(최종 선택은 사용자가 조정), [건너뛰기]/[등록] 버튼. [등록]을 눌러야 기존 `createSchedule` 서버 액션이 호출되어 실제 DB에 저장됨(RLS 그대로 유지) — `supplies`는 DB 저장 시 기존 관례대로 `memo`에 합쳐짐. 전부 처리되면 "N개 등록 · M개 건너뜀" 요약 말풍선 표시
- ✅ 에러 처리: 서버 미응답/네트워크 오류 시 "잠시 후 다시 시도해주세요" 말풍선 + `/schedule`로 이동하는 수동 등록 유도 링크
- ✅ 2026-07-10 **루틴(반복되는 하루 일과) 등록 채널 추가** — 기존 일정 파이프라인을 확장해 같은 대화창/같은 확인 카드 흐름으로 처리:
  - 그래프 구조 변경: `Plan(이미지/텍스트 판별) → ClassifyIntent(일정/루틴/혼합 판별) → Execute(의도별 추출) → [다중 일정이면 RefineRoutine 직행 | 단일이면 RefineSchedule → RefineRoutine] → Finalize`. `ClassifyIntent`는 LLM 호출 없이 키워드 휴리스틱만 사용(루틴 신호: "매주/평일/매일/하루 일과/기상/등원/하원/취침" 등)해서 루틴 신호가 전혀 없으면 항상 기존과 동일하게 "schedule"로 판단 — 기존 일정 전용 입력의 동작을 100% 보존
  - 루틴 추출은 `_extract_routines_from_text`(전용 프롬프트)가 담당하고 텍스트 입력만 지원(이미지 속 일과표는 이번 범위 밖). 상태(`status`) 어휘는 `src/lib/routineUtils.ts`의 `STATUS_OPTIONS`(업무/수업/운동/공부/휴식/취침/이동/커스텀)와 동일하게 맞춰 `--routine-*` 색상 변수와 바로 연결됨
  - 시간 규칙: "7시부터 8시까지"처럼 범위가 있으면 그대로, "7시 기상"처럼 시점 하나만 언급되면 시작 시각+10분을 종료로 자동 설정, "오전에 운동"처럼 구체적 시각이 **전혀** 없을 때만 `RefineRoutine` 노드가 `interrupt`로 되물음(빈 시간대를 임의로 블록화하지 않음)
  - 혼합 입력(일과 설명 + 특정 날짜 일정)은 `ClassifyIntent`가 "mixed"로 판단해 일정/루틴을 각각 추출 후 `{schedules:[...], routines:[...]}`로 함께 반환 — 실제 Gemini 키로 세 가지 케이스(루틴 전용/일정 전용/혼합) 모두 검증 완료
  - 프론트: `ConfirmCards`에 루틴 카드 타입 추가(같은 가로 스와이프 캐러셀 안에서 `kind: "schedule" | "routine"`으로 분기). 카드 상단 요일 칩(수정 가능, 최소 1개 유지)+대상 멤버 단일 선택(managed 멤버 포함, `routine.member_id`가 배열이 아닌 단일 값이라 일정의 다중 대상 선택과 다름)+블록 리스트(인라인 수정/삭제)로 구성. 대상/요일이 바뀔 때마다 새 서버 액션 `getRoutineBlocks`로 그 멤버의 기존 블록을 다시 불러와 시간 겹침을 감지하고 "OO요일 기존 09:00~10:00 운동과 겹침" 경고 + "겹치는 기존 블록 덮어쓰기" 체크박스를 보여줌(체크 안 하면 기존 블록은 남기고 새 블록만 추가). [등록]은 기존 `upsertRoutine` 서버 액션을 선택된 요일마다 호출(요일별 전체 교체 방식이라 프론트에서 기존+신규 블록을 먼저 병합)
  - 등록 완료 시 카드에 "루틴 N개 요일에 적용했어요" + `/schedule/routine`으로 가는 링크 표시(스케줄 카드의 "등록됨" 배지 자리를 대체)
  - `AgentSheet` 첫 안내 문구를 "일정이 담긴 사진이나 텍스트, 또는 하루 일과를 알려주세요."로 변경. `AgentLauncher`/`AgentSheet`/`ConfirmCards`에 로그인한 본인의 `workspace_member.id`(`currentMemberId`)를 새로 전달해, 루틴 카드의 대상이 비어있을 때 기본값으로 사용
- ✅ 2026-07-11 **API 키 인증 + 이미지 페이로드 제한** — `main.py`의 `verify_api_key` 의존성이 `AGENT_API_KEY` 설정 시 `/process-schedule`/`/extract-text`의 `X-API-Key` 헤더를 검증(`/health`는 제외, 미설정이면 인증 생략). `image_base64`는 원본 기준 약 8MB 초과 시 413. `AgentSheet`/`BoardSection`(둘 다 클라이언트 컴포넌트)이 에이전트 서버로 직접 fetch하던 구조라 `AGENT_API_KEY`를 그대로 클라이언트에 심을 수 없어, 새 route handler `src/app/api/agent/process-schedule`·`/extract-text`(`src/lib/agentServer.ts`의 `proxyAgentRequest()`)를 두고 브라우저 → Next 서버 → 에이전트 서버로 경유하도록 변경. `agentApi.ts`는 이제 이 route handler만 호출함
- ✅ 2026-07-12 **로그인 검증 + 이미지 클라이언트 압축**:
  - 두 route handler(`/api/agent/process-schedule`, `/api/agent/extract-text`)가 에이전트 서버로 프록시하기 전에 `requireAuthOrRespond()`(`src/lib/agentServer.ts`, 신규)로 `supabase.auth.getUser()`를 확인 — 미로그인이면 `401 { error: "로그인이 필요합니다." }`를 바로 반환하고 에이전트 서버로는 넘기지 않음. 이전엔 `AGENT_API_KEY`(에이전트 서버 자체 인증)만 있고 "이 Next.js 앱에 로그인한 사용자인가"는 확인하지 않아, 로그인 없이도 이 프록시 경유로 에이전트(Gemini 호출)를 계속 두드릴 수 있었음. 실제로 쿠키 없이 두 라우트를 호출해 둘 다 401 뜨는 것 확인
  - `src/lib/imageCompress.ts`(신규) — 에이전트로 이미지를 보내는 두 지점(`AgentSheet.tsx`의 사진 첨부, `BoardSection.tsx`의 "사진에서 텍스트 채우기")이 base64 인코딩 전에 공유하는 `compressImage(file)`. canvas로 그려서 장변 1600px 초과 시 축소 + JPEG 품질 0.85로 재인코딩, 압축 결과가 원본보다 크면 원본 그대로 반환(canvas 처리 실패 시에도 원본으로 폴백). Next.js API 라우트가 Vercel에 배포되면 요청 바디 4.5MB 제한에 걸리는데, 스마트폰 카메라 원본 사진은 base64 인코딩만으로 그 한도를 넘기 쉬워서 클라이언트에서 먼저 줄여 보내는 목적 — 두 지점 다 기존에 각자 갖고 있던 `FileReader.readAsDataURL` 직접 호출을 이 공용 유틸로 교체(`BoardSection.tsx`의 옛 `fileToBase64()`는 삭제)
- ⚠️ 아직 음성 입력, 일정 외 탭(식탁/장바구니/게시판)으로의 라우팅, 루틴의 이미지 입력은 미구현 (PRD_fridge § 6 참고)
- ⚠️ 2026-07-12 이미지 압축(`imageCompress.ts`)은 canvas/Image가 브라우저 전용 API라 이 환경(로그인된 브라우저 없음)에서 실제 사진으로 압축률·화질을 직접 확인하지 못함 — `tsc`/`lint`/코드 리뷰까지만 확인, 실제 스마트폰 사진으로 사진 첨부→전송 흐름을 브라우저에서 확인 필요

**게시판 탭** (`/board`) — 독바에서 "설정"을 대체. 2026-07-08 좌우 2단(6:4) → **세로 스택**으로 재배치(위→아래: ① 스티커 ② 메모·공지 ③ 장바구니), 홈과 동일하게 `SectionLabel`+`--section-indent`+헤어라인 구분 적용
- ✅ ① 하고싶은 말(구 "스티커", 2026-07-10 명칭 변경 — DB `notice.type='sticky'` 값 자체는 그대로) — 가로 슬라이드(스크롤), 카드 안에 작성자(작게·옅게)+내용, D-N 배지는 카드 **밖** 오른쪽 아래. 댓글 없음. 개수 제한 없음(가로 스크롤로 전부 접근 가능하므로 "더보기" 대상 아님)
  - ✅ 2026-07-10 비주얼 전면 교체: 라운드 카드 → **직사각형 + 오른쪽 아래 모서리 접힘 효과**(카드 자체는 `clip-path`로 모서리를 잘라내고, 그 자리에 배경색보다 15%쯤 어두운 삼각형(`border` 트릭)을 덧대 "종이 한 장이 접힌" 느낌을 줌 — 5가지 고정 파스텔 색상마다 `STICKER_FOLD_COLORS`에 미리 계산된 그림자색을 매핑). 내용 텍스트는 `next/font/google`의 `Nanum Pen Script`(변수 `--font-handwriting`, Tailwind `font-handwriting`)로 렌더링 — 스티키노트에만 적용, 다른 곳은 기존 폰트 그대로. 크기는 96px(`w-24`) → 112px(`w-28`)로 키우고 `min-h-28`+고정 `line-clamp` 제거 대신 `line-clamp-5`로 완화해 내용 길이에 따라 세로로 늘어나도록 함
  - ✅ 2026-07-10 이미지 첨부 — `supabase/add_notice_image.sql`로 `notice.image_url` 컬럼 + `notice-images` Storage 버킷(경로 `{user_id}/{filename}`, 쓰기는 본인 폴더만) 추가. 작성 시트에서 `AvatarUploader`와 동일한 브라우저 직접 업로드 패턴(`createClient().storage.from("notice-images").upload(...)` → `getPublicUrl`)으로 올리고, 카드에서는 텍스트 **위**에 썸네일(`h-12` 고정, 내용 텍스트는 그 아래)로 표시
- ✅ ② 메모·공지 — 작성자·시간 헤더 + 내용 미리보기, 공지는 제목 앞 📌 표시(기존 `is_pinned` 상단고정과는 별개 개념). **3개 초과 시 하단에 "더보기"** — 게시판이 이미 최종 목적지라 홈 미리보기처럼 다른 라우트로 이동하는 링크가 아니라, 같은 자리에서 펼쳐지는 토글(`postsExpanded` 상태)
  - ✅ 2026-07-10 줄바꿈 버그 수정 — 목록 미리보기(`line-clamp-2`)와 `/notifications` 미리보기에 `whitespace-pre-wrap`이 빠져 있어 입력한 줄바꿈이 브라우저 기본 동작(연속 공백/줄바꿈 축약)으로 사라져 보였음. 상세 시트는 원래부터 `whitespace-pre-wrap`이 있어 문제 없었음 — 저장 쪽 `content.trim()`은 문자열 앞뒤만 자르므로 내부 줄바꿈과는 무관(원인 아님)
  - ✅ 2026-07-10 이미지→텍스트 자동 채우기 — 작성 시트에 "사진에서 텍스트 채우기" 버튼 추가, 첨부한 이미지를 base64로 에이전트 서버의 신규 엔드포인트 `POST /extract-text`(Gemini, 저장 없이 텍스트만 반환)로 보내 내용란에 자동 삽입(사용자가 이어서 수정 후 등록). 기존 일정 파싱 엔드포인트/에이전트 서버를 그대로 재사용 — 별도 서버 없음. 2026-07-12부터 base64 인코딩 전에 `compressImage()`(`src/lib/imageCompress.ts`)로 리사이즈/재인코딩(아래 "일정 파싱 에이전트" 섹션 참고)
- ✅ 메모/공지 댓글 — 2026-07-07 신규 `notice_comment` 테이블 + `addNoticeComment` (`meal_comment`/`addMealComment` 패턴 그대로 미러링). 하고싶은 말은 댓글 없음
- ✅ 2026-07-11 **수정 기능** — 하고싶은 말/메모/공지 전부 수정 가능. 카드/리스트 행에 작성자 본인에게만 보이는 연필 아이콘(`IconPencil`) 추가 — 스티키노트는 배경이 항상 밝은 파스텔이라 `--text-muted`(다크 모드에서 밝은 회색이라 저대비) 대신 기존 `STICKER_TEXT_COLOR` 고정색을 `opacity-60`으로 사용, 메모·공지 행은 지시대로 `--text-muted` 그대로 사용. 눌리면 새로 만드는 게 아니라 같은 `AddPostSheet`가 기존 값(제목/내용/색상/이미지/고정여부)을 채운 채 열리고, 저장 시 신규 서버 액션 `updateNotice`(작성자 검증은 `deleteNotice`와 동일한 패턴) 호출. `AddPostSheet`는 시트가 상시 마운트된 채 `open`만 토글되는 구조라 필드를 한 번만 `useState` 초기값으로 채우면 "추가 → 수정"으로 열릴 때 이전 값이 남는 문제가 있어, `open`/`existingNotice`가 바뀔 때마다 필드를 다시 채우는 `useEffect` 기반으로 리셋 로직을 교체. 유효기간(`expireDays`) 칩은 수정 모드에서 숨김(수정은 만료일을 새로 정하지 않고 기존 값을 그대로 둠)
- ✅ 2026-07-11 **입력 동선 + 카드 디테일 개선**:
  - 게시판 상단의 전역 `+` 버튼 제거 — "하고싶은 말"은 스티커 가로 스크롤 맨 끝에 점선 테두리 직사각형(스티커와 동일 `w-28`/`min-h-28`, 라운드 없음) + 아이콘 버튼을 상시 노출(스티커가 하나도 없어도 이 자리가 그대로 시작 지점이 됨), "메모 · 공지"는 `SectionLabel`의 `onAdd`로 라벨 오른쪽 + 아이콘. 두 진입점 모두 `AddPostSheet`를 해당 타입이 미리 선택된 채로 염 — 스티커 진입은 `fixedType="sticky"`(픽커 자체가 없음), 메모/공지 진입은 신규 `initialType="memo"` prop으로 기본값만 지정하고 픽커는 그대로 열려 있되 이제 메모/공지 2개만 보여줌(전역 버튼이 없어졌으니 픽커에서 "하고싶은 말" 옵션 자체를 제거)
  - 메모/공지 리스트 카드 — 제목 14→13px, 내용은 `line-clamp-2`+`text-ink` → `truncate`(한 줄) + `text-[var(--text-muted)]`로 축소, 작성자·시간(+연필 아이콘)을 `ml-auto`로 행 오른쪽 끝에 정렬(핀 아이콘은 왼쪽 그대로)
  - 상세 시트(메모/공지) — 좌측 하단 "삭제하기" 텍스트 버튼 제거 → 시트 우상단 연필 아이콘(작성자만, `IconPencil`)이 인라인 수정 모드를 토글. 수정 모드에서는 제목/내용이 `Input`/`Textarea`로 바뀌고 작성자·시간은 그대로 오른쪽 하단에 표시, 하단에 [삭제]/[저장] 버튼 — 저장은 `updateNotice`를 호출하며 `isPinned`는 항상 기존 값을 그대로 넘겨(전달 안 하면 액션이 `false`로 덮어써서 고정이 풀리는 부작용이 있어 명시적으로 유지) 고정 여부가 의도치 않게 풀리지 않게 함. [삭제]는 바로 지우지 않고 "정말 삭제하시겠어요?" 확인 화면(취소/삭제하기)을 한 번 더 거친 뒤 `deleteNotice` 호출. 목록 행의 기존 연필(바로 `AddPostSheet` 열기)은 그대로 유지되어, 상세를 먼저 열어보고 고칠지 목록에서 바로 고칠지 두 경로가 공존함
  - 하고싶은 말 상세 시트 — 그동안 빠져 있던 작성자 표시 추가, 오른쪽 끝에 좋아요(하트) 버튼 신설(`notice_like` 신규 테이블 — `notice_id`+`user_id` 복합 PK는 `meal_like`와 동일 패턴, RLS는 `notice_comment`와 동일하게 `notice`를 경유해 워크스페이스 확인. 서버 액션 `toggleNoticeLike`는 `toggleMealLike` 미러링). `board/page.tsx`의 notice 조회에 `notice_like(user_id)` 임베드를 추가해 카드/상세에서 바로 좋아요 수·내가 눌렀는지를 계산. 스티키노트 본문 폰트는 상세 시트 기준 18→16px로 한 단계 축소(카드 쪽은 이미 16px)
- ✅ 2026-07-11 홈의 "오늘 뭐먹지"/"오늘 뭐하지" 사이에 있던 세로 헤어라인(`border-l`) 제거 — 그리드 `gap-4`만으로 구분
- ✅ 2026-07-11 **메모/공지 버그 수정 4건**:
  - 정렬 — `posts` 정렬 기준이 `is_pinned`뿐이라(`Number(b.is_pinned) - Number(a.is_pinned)`), 고정되지 않은 공지가 그보다 늦게 등록된 메모보다 아래로 밀리는 문제가 있었음(둘 다 `is_pinned=false`면 원래 순서=최신순만 남아 최신 메모가 이김). 비교 함수에 "고정 우선 → 그다음 공지가 항상 메모보다 위 → 그래도 같으면 원래 순서 유지" 단계를 추가
  - 목록 행의 핀 아이콘(`is_pinned`일 때 왼쪽 끝에 뜨던 `IconPin`, 라벨 없이 아이콘만이라 용도가 불분명했음) 삭제. 아이콘이 빠지며 남은 작성자·시간·연필을 담던 `ml-auto` 내부 래퍼도 걷어내고 바깥 flex 컨테이너에 `justify-end`만 남김(상세 시트의 동일 라인과 같은 패턴)
  - `AddPostSheet` 메모/공지 유형 토글 — 기존엔 `!fixedType && !existingNotice` 조건이라 **수정 모드에서는 토글 자체가 숨겨져** 메모↔공지 전환이 불가능했음. 조건을 `!fixedType && type !== "sticky"`로 바꿔 수정 중에도 토글이 보이게 하고, `updateNotice`(`board/actions.ts`)에 `type?: "memo" | "notice"` 파라미터를 추가 — 서버에서 `notice.type !== "sticky" && input.type`일 때만 반영(`nextType`)해, 스티키는 절대 메모/공지로 전환되지 않도록(반대도 마찬가지) 가드
  - 이미지 삽입 ⇄ 텍스트 추출(OCR) 분리 — 메모/공지 작성 시트에 있던 카메라 아이콘 버튼은 원래 OCR("사진에서 텍스트 채우기", 추출한 텍스트만 본문에 채우고 이미지 자체는 버림) 하나뿐이었음. 이제 카메라 아이콘(`IconCamera`)은 신규 "이미지 삽입" 버튼(스티키의 "사진 첨부"와 동일한 업로드 핸들러 `handleImageSelected`를 공유 — `notice-images` 버킷에 올리고 `imageUrl` 상태에 반영)에 배정하고, 기존 OCR 버튼은 `IconPhotoScan` 아이콘으로 바꿔 별도 버튼으로 유지. `addNotice`/`updateNotice` 둘 다 `image_url`을 더 이상 sticky 전용으로 취급하지 않고 모든 타입에 그대로 저장, 상세 시트의 이미지 렌더링도 `detail.type === "sticky"` 조건을 없애 메모/공지에도 동일하게 표시
- ⚠️ ③ 장바구니 — **2026-07-10 게시판에서 완전히 분리**됨 (아래 "장바구니(글로벌 시트)" 섹션 참고). `ShoppingList.tsx`는 삭제됨
- `addNotice`/`deleteNotice`/`addNoticeComment` 액션은 `home/actions.ts`에서 `board/actions.ts`로 이동함 (게시판이 독립 라우트가 됐으므로)
- 2026-07-08: `tailwind.config.ts`의 `grid-cols-board`(3fr 2fr) 토큰은 더 이상 쓰이는 곳이 없음(세로 스택으로 전환) — 향후 다시 2단 레이아웃이 필요해지면 재사용 가능하므로 설정 자체는 남겨둠

**장바구니(글로벌 시트)** — 2026-07-10 신규, 게시판 탭에서 분리해 **어느 탭에서든 열리는 전역 바텀시트**로 전환
- ✅ 진입점: 홈 "장바구니" 위젯(`HomeShoppingSection`)의 + 버튼과 리스트 클릭 — 2026-07-11부터 **완전히 같은 시트 하나**를 연다(예전엔 + 버튼이 별도 `ShoppingQuickAddSheet`를 여는 중복이 있었음, 삭제됨). 2026-07-11부터 독바(`DockBar`)에는 장바구니 항목 자체가 없음(홈/식탁/일정/게시판 4개만) — 장바구니는 홈에서만 진입 가능
- ✅ 구조: `(main)/layout.tsx`에 신설한 `ShoppingSheetProvider`(Context, `src/components/shopping/ShoppingSheetContext.tsx`)가 모든 탭 공통 레이아웃에서 `GlobalShoppingSheet`를 항상 마운트해두고 `open`/`close` 상태만 관리. `useShoppingSheet()` 훅으로 `HomeShoppingSection` 등 어디서든 열 수 있음
  - 시트는 layout이 아니라 시트 자신이 열릴 때마다(`open` 변경 시) 신규 서버 액션 `getShoppingItems`(`src/app/(main)/shopping/actions.ts`)로 직접 재조회함 — 여러 탭에 걸쳐 열리는 전역 UI라 특정 페이지의 `revalidatePath`만으로는 다른 탭에 떠 있는 시트까지 못 갱신하기 때문에 서버 컴포넌트 props 대신 이 방식을 택함
- ✅ 2026-07-11 **상단 세그먼트 [장볼 것 | 기록]** 추가 — 시트가 열릴 때마다 항상 "장볼 것" 탭으로 초기화(`useEffect`가 `open` 변경 시 `setTab("list")`)
  - **장볼 것** 탭: 입력란(오른쪽에 마이크 아이콘 — `webkitSpeechRecognition` 지원 브라우저에서만 노출, `ko-KR`로 인식한 텍스트를 입력란에 채워넣음, 인식 중엔 honey 색) + 목록(`ShoppingItemRow` 전체가 탭 영역 — 탭하면 `toggleShoppingPurchased` 호출, 왼쪽 스와이프 또는 x로 삭제). **2026-07-11부터 목록 필터가 `!is_purchased` → `!expense_id`로 변경** — 체크해도(취소선은 표시되지만) 목록에서 바로 사라지지 않고, "장보기 완료"로 실제 `expense`에 묶여야 비로소 목록에서 빠지고 "기록" 탭으로 넘어감(예전엔 체크 즉시 날짜별 아카이브로 이동했었음 — 그 아카이브 UI는 아래 "기록" 탭으로 완전히 대체되어 이 컴포넌트에서는 삭제됨)
  - "장보기 완료" 버튼은 항상 노출되고(체크한 게 없으면 비활성) 누르면 **구매처/금액 두 입력만** 있는 인라인 폼이 열림 — 확정 버튼명 "기록하기". 완료 시 서버 액션 `completeGroceryRun`이 `expense`에 `category='grocery'` 행 하나를 만들고(place는 `expense.place` 전용 컬럼에 저장 — 예전엔 `memo` 겸용이었음), 대상 항목들의 `shopping_item.expense_id`를 그 행으로 연결, 재고 반영은 토글 없이 **항상 자동으로** `fridge_item`에 추가(카테고리는 `cold` 고정)
  - ⚠️ **디자인 결정**: 이전에 있던 영수증 첨부 버튼과 "재고에 추가" on/off 토글을 이 완료 폼에서 제거함(사용자가 준 UX 스펙이 구매처/금액 두 입력만 정의하고 있어 그대로 따름). 영수증은 이제 이 플로우에서 첨부할 방법이 없고, "기록" 탭의 회차 상세에 있는 비활성 "영수증 사진으로 품목·단가 자동입력 · 준비 중" 버튼이 나중에 그 자리를 대신할 예정(P2) — 지금은 `expense.receipt_image_url`을 채울 방법 자체가 없음. 재고 추가를 끄고 싶었던 사용자는 더 이상 그 옵션이 없다는 점 참고
- ✅ 2026-07-11 **기록 탭** 신규 — 월 달력(일~토, `getGroceryRuns(workspaceId, year, month)`로 그 달의 grocery `expense` + 연결된 `shopping_item` 이름들을 조회) + grocery가 있는 날짜에 honey 점 + 날짜 탭하면 그 회차만 필터. "이번 달 장보기 N회 · 합계"(월별 조회 결과로 클라이언트에서 합산). 검색창은 300ms 디바운스 후 `searchGroceryRuns(workspaceId, query)` 호출(품목명 또는 구매처 부분일치, 최신순 20건). 회차 행은 날짜·구매처·품목 미리보기(말줄임)·금액, 탭하면 상세로 전환 — 상세는 산 것들 리스트 + 영수증(`receipt_image_url` 있으면 썸네일, 없으면 "등록된 영수증이 없어요") + 위에서 설명한 비활성 자동입력 버튼
  - 서버 액션 2종(`shopping/actions.ts`) 추가: `getGroceryRuns`/`searchGroceryRuns` — 둘 다 실패 시 `{ ok: false, message }` 반환(DB 에러 포함, 이 두 조회 함수는 명시적으로 이 패턴을 쓰기로 함). 내부적으로 `groupRuns()` 공용 헬퍼가 `shopping_item`을 `expense_id IN (...)` **한 번**으로 조회해 회차별로 묶어 N+1을 피함(회차 개수와 무관하게 조회 쿼리 수 고정). `searchGroceryRuns`는 사용자 입력을 raw 문자열로 `.or()` 필터에 끼워넣지 않고 `.ilike()`/`.in()` 메서드 파라미터로만 전달(필터 인젝션 방지) — 구매처 매칭과 품목 매칭을 각각 조회한 뒤 JS에서 병합·중복제거·최신순 정렬·20건 컷
- ✅ 마이그레이션: `supabase/add_shopping_expense_link.sql`(`shopping_item.expense_id`, `expense.receipt_image_url`, `receipts` 버킷) + **2026-07-11 신규** `supabase/add_expense_place.sql`(`expense.place` 컬럼 추가 + 기존 grocery 행의 `memo`→`place` 백필 + `shopping_item.expense_id` 인덱스, 기록 탭의 회차-품목 조회 성능용)
- ⚠️ 영수증 OCR(자동 금액/항목 인식)은 미구현 — "기록" 탭 상세의 자동입력 버튼은 항상 비활성(P2)
- ⚠️ 일정 탭 "그로서리 템플릿"(`schedule.is_grocery`)으로 등록한 일정도 `linked_schedule_id`를 가진 `expense(category='grocery')` 행을 만드는데, 이쪽은 `place`를 채우지 않고 `shopping_item`과도 연결되지 않음 — 그래서 이 행들은 "기록" 탭의 이번 달 합계/달력 점에는 포함되지만 회차 상세에서는 구매처가 "장보기"로만 보이고 품목 목록이 비어 있음(그래도 정상 동작, 에러 아님)

**알림** (`/notifications`) — 2026-07-07 신규, 헤더의 🔔 아이콘으로만 진입 (독바에 없음, `/settings`와 동일한 진입 방식)
- ✅ `notice` 테이블에서 `type = 'notice'`인 항목만 시간순으로 나열, 각 항목에 "게시판에서 보기" 링크. 댓글 등 상호작용은 게시판 탭에 집중, 여기선 읽기 전용 요약만

**설정 탭** (`/settings`) — 독바에서 빠지고, 홈 헤더의 ⚙️ 아이콘으로 진입 (라우트 자체는 그대로 존재)
- ✅ 프로필 이미지 업로드 (위 "프로필 이미지" 참고)
- ✅ 가족 구성원 관리 (리스트 뷰 — PRD의 "조직도 뷰"는 아님). 2026-07-10: "구성원 추가" 버튼(신규 `MemberList.tsx`/`ManagedMemberSheet.tsx`)으로 계정 없는 관리 멤버(자녀 등) 추가/수정/삭제 — 자세한 내용은 위 "가족 구성원 모델" 섹션 참고
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
    home/                  HomeHeader(2026-07-09: `FamilyMemberStatus[]` 전체를 직접 받아 가족 전체 상태 행 렌더 — `FamilyStatusCard.tsx`는 이 변경으로 완전히 미사용이 되어 삭제됨)/MealSummaryCard/TodayEvents — 전부 "스마트미러" 스타일(카드 제거, mirror.* 토큰 사용). SectionLabel(아이콘+라벨 한 줄 공용 컴포넌트, 2026-07-09: 옵션 `onAdd`/`addLabel`로 라벨 줄에 + 버튼 추가 가능), HomeSections(모바일 홈 섹션 드래그앤드롭 — `@dnd-kit` 기반, 2026-07-11: `grid-cols-2`+`rectSortingStrategy`로 4위젯 자동 배치), ShoppingList(게시판 탭 전체 관리용), BoardSection(게시판 탭, `AddPostSheet`를 2026-07-09부터 export + `fixedType` prop 지원), HomeMealSection/HomeTodaySection(2026-07-09 신규: 섹션 라벨+콘텐츠+빠른 추가 시트를 묶는 래퍼), HomeStickySection/HomeShoppingSection(2026-07-11 신규: `BoardPreview.tsx`를 위젯 4분할하며 대체, 각각 독립 위젯), MealQuickAddSheet(끼니 전용 빠른 추가 시트 — 장바구니는 2026-07-11부터 전용 시트 없이 `GlobalShoppingSheet` 재사용)
    food/                  MealCard, MealDetail, AddMealScreen, WeekCalendar
    schedule/              MonthView/WeekView/YearView, AddEventEntry(+picker+4개 Sheet), EventFilters, RoutineEditor(2026-07-09 전면 재설계 — 아래 "내 루틴" 참고), RoutineWheel(2026-07-09 신규: 24h 도넛 차트), PlaceInput (2026-07-08: 일정 탭 전용 AiAssistButton 플레이스홀더는 삭제됨 — agent/ 아래 참고)
    agent/                 2026-07-08 신규, 같은 날 오후 일정 탭 전용으로 범위 축소: AgentLauncher(플로팅 버튼), AgentSheet(바텀시트 대화창), ConfirmCards(확인 카드, 입력 소스 무관 재사용 가능하게 설계)
    settings/              AvatarUploader(프로필 이미지 업로드), ThemeToggle(화면 모드 전환), ShareLinkSection(2026-07-07 신규, 토큰 기반 공유 링크 + 재발급 버튼), MemberList/ManagedMemberSheet(2026-07-10 신규: 계정 없는 관리 멤버 추가/수정/삭제)
    ui/                    BottomSheet, Toast(+ToastProvider/useToast), ThemeProvider(useTheme 훅+localStorage 영속화), Avatar(imageUrl 지원), TagChip, CheckToggle, DockBar(2026-07-08: `bg-cream` 배경 복원 — 완전 투명이라 스크롤 시 콘텐츠와 겹쳐 보이는 문제가 있었음), CopyLinkButton, Input(2026-07-08 신규: `Input`/`Textarea` — 앱 전체 입력 필드 색상 통일용 공용 컴포넌트)
  lib/
    supabase/              client.ts(브라우저, avatar 업로드에도 사용) / server.ts(서버, 쿠키 기반) / admin.ts(서비스 롤, 공유 페이지 전용) / middleware.ts(세션 갱신)
    workspace.ts            requireWorkspaceContext() — 로그인+워크스페이스 멤버십 가드, {supabase,user,workspaceId,role,displayName} 반환
    members.ts               mapWorkspaceMembers() — workspace_member+users 조인 결과를 화면용 형태로 변환하는 공용 헬퍼. 2026-07-10: account/managed 멤버를 WorkspaceMemberInfo(id/user_id/member_type/display_name/avatar_*/birth_year)로 통일해서 반환하도록 확장
    uiTokens.ts               AVATAR_SIZE(mirror 18px 추가), SHOPPING_DOT_SIZE — 여러 컴포넌트가 공유하는 크기값
    homeTheme.ts              2026-07-07 신규: mirror.* — 홈 화면 전용 CSS 변수 참조 클래스 모음(bg/primary/secondary/muted/hairline/label). 다른 탭의 cream/ink/stone과는 별개 팔레트
    homeLayout.ts             2026-07-08 신규: HomeSectionId 타입 + resolveHomeLayout() — 저장된 홈 섹션 순서를 알려진 id만 남기고 미래에 추가될 섹션은 뒤에 이어붙이는 헬퍼
    date.ts                  날짜 포맷/이동 유틸 (toDateStr, formatYearMonth, addMonths, formatPostTimestamp, WEEKDAY_LABEL 등)
    weather.ts               OpenWeatherMap 서버 전용 fetch 헬퍼 (키 없거나 실패 시 null)
    holidays.ts               2026년 KR 공휴일 정적 목록 (실 API 교체 지점 TODO 주석 있음)
    scheduleKeywords.ts       일정/할 일 공용 태그+색상 그룹 (KEYWORD_GROUPS) — agent/agent.py의 KEYWORD_GROUPS와 동일하게 유지할 것
    scheduleTargets.ts        2026-07-08 신규: targetLabel()/MemberInfo — 일정의 target_members를 "가족"/이름/"가족 외 N"으로 표시하는 공용 헬퍼. TodayEvents(홈)와 MonthView/WeekView/YearView(일정 탭)가 함께 재사용
    lunar.ts                  2026-07-12 신규: Intl.DateTimeFormat('ko-u-ca-dangi') 기반 음력 변환 — solarToLunar()/lunarToSolarInYear(), 연도별 매핑 메모이제이션
    recurrence.ts             2026-07-12 신규: expandRecurring() — monthly/yearly(+lunar) 반복 일정을 저장 없이 화면 범위만큼 가상 인스턴스로 전개
    agentApi.ts               2026-07-08 신규: callAgent()/extractTextFromImage(), AgentSchedule/AgentResponse/AgentMemberOption 타입. 2026-07-11: 에이전트 서버로 직접 나가지 않고 같은 오리진의 /api/agent/* route handler를 호출하도록 변경(AGENT_API_KEY 비노출용, agentServer.ts 참고)
    agentServer.ts            2026-07-11 신규: proxyAgentRequest() — /api/agent/* route handler 전용 서버 코드. NEXT_PUBLIC_AGENT_API_URL로 에이전트 서버에 요청을 그대로 전달하되, 서버 전용 환경변수 AGENT_API_KEY가 있으면 X-API-Key 헤더에 실어 보냄. 2026-07-12: requireAuthOrRespond() 추가 — 로그인 안 했으면 401 Response를 돌려주는 공용 헬퍼, 두 route.ts가 공유
    imageCompress.ts          2026-07-12 신규: compressImage(file) — 에이전트로 보내는 이미지 첨부를 canvas로 리사이즈(장변 1600px)+JPEG 0.85 재인코딩해 base64로 반환(Vercel 프록시 바디 4.5MB 제한 대비). AgentSheet.tsx/BoardSection.tsx가 공유
    mealUtils.ts / routineUtils.ts   끼니/루틴 관련 계산 유틸 (2026-07-08: 태그별 가상 시각을 만들어 보여주던 `tagHourLabel`은 오해를 일으켜 제거 — 실제 시각 정보는 외식 `reservation_time`만 사용)
    routineColors.ts          2026-07-09 신규: STATUS_COLOR_VAR — 루틴 상태(업무/수업/운동/공부/휴식/취침/이동/커스텀) → globals.css의 --routine-* CSS 변수 이름 매핑
  types/index.ts            전체 테이블에 대응하는 TS 인터페이스 (NoticeComment, FamilyWorkspace.share_token 2026-07-07 추가)
src/app/api/agent/
  process-schedule/route.ts                               2026-07-11 신규: POST — proxyAgentRequest()로 에이전트 서버 /process-schedule에 프록시
  extract-text/route.ts                                    2026-07-11 신규: POST — proxyAgentRequest()로 에이전트 서버 /extract-text에 프록시
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
  add_managed_members.sql                                    2026-07-10 신규: workspace_member에 member_type/name/avatar_color/avatar_image_url/birth_year 추가, routine.user_id→member_id 전환, schedule.target_members를 workspace_member.id 기준으로 백필 (실행 완료)
  add_expense_source.sql                                     2026-07-11 신규: expense.source TEXT DEFAULT 'offline' 컬럼 추가 — 파일만 생성, 실행은 보류(사용자가 직접 실행 예정)
  add_expense_place.sql                                      2026-07-11 신규: expense.place 컬럼 추가 + grocery 행 memo→place 백필 + shopping_item.expense_id 인덱스 (실행 필요)
  add_meal_image.sql                                         2026-07-11 신규: meal-images Storage 버킷 + RLS(퍼블릭 읽기, 본인 폴더만 쓰기/삭제) — 끼니 이미지 삽입용 (실행 필요)
  add_schedule_recurrence.sql                                2026-07-12 신규: schedule.recur_type/recur_calendar/recur_until 컬럼 추가 (반복 일정용, 실행 필요)
middleware.ts                                              프로젝트 루트, 모든 요청에 대해 세션 갱신 (updateSession 위임)
agent/                                                     2026-07-08 신규: Next.js와 분리된 Python 에이전트 서버 (별도 실행/배포 대상, 아래 "일정 파싱 에이전트 로컬 실행" 참고)
  main.py                                                  FastAPI 진입점 — POST /process-schedule, /extract-text(둘 다 AGENT_API_KEY 설정 시 X-API-Key 헤더 검증 + image_base64 약 8MB 초과 시 413), GET /health(인증 제외)
  agent.py                                                 LangGraph 그래프 (plan/execute/refine/return_single/prepare_multi 노드), Gemini 2.5 Flash 호출, 날짜/시간 정규화 헬퍼
  requirements.txt                                          langgraph, langchain-google-genai, fastapi, uvicorn 등
  .env.example                                              GEMINI_API_KEY, ALLOWED_ORIGINS, AGENT_API_KEY(2026-07-11 신규, 미설정 시 인증 생략)
```

## 환경변수

`.env.local`(Next.js)에 필요한 키 (값은 기록하지 않음):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENWEATHER_API_KEY` — 2026-07-07 추가, 홈/일정 탭 날씨 표시용
- `NEXT_PUBLIC_AGENT_API_URL` — 2026-07-08 추가, 일정 파싱 에이전트 서버 주소 (로컬 기본값 `http://localhost:8000`). 2026-07-11부터 브라우저가 아니라 `/api/agent/*` route handler(서버)만 이 값을 읽음 — `NEXT_PUBLIC_` 접두사는 유지하지만 더 이상 클라이언트에서 직접 쓰이지 않음
- `AGENT_API_KEY` — 2026-07-11 추가, 서버 전용(접두사 없음 — 브라우저에 노출되면 안 됨). `agent/.env`의 같은 이름 값과 동일하게 맞출 것. `/api/agent/*` route handler가 에이전트 서버에 요청을 프록시할 때 `X-API-Key` 헤더로 실어 보냄

`agent/.env`(Python 에이전트 서버, `agent/.env.example` 참고)에 필요한 키:
- `GEMINI_API_KEY` — Google AI Studio에서 발급
- `ALLOWED_ORIGINS` — CORS 허용 도메인, 콤마 구분 (로컬 기본값 `http://localhost:3000`, 배포 후 실제 Vercel 도메인 추가 필요)
- `AGENT_API_KEY` — 2026-07-11 추가, 설정하면 `/process-schedule`/`/extract-text`에 `X-API-Key` 헤더 검증을 강제(`/health`는 제외). 미설정 시 인증 생략(로컬 개발 기본값) — 배포 환경에서는 반드시 설정하고 Next.js `.env.local`의 `AGENT_API_KEY`와 같은 값으로 맞출 것

## Supabase 스키마 현황

**테이블 (18개)**: `family_workspace, users, workspace_member, routine, schedule, meal, meal_participation, meal_like, meal_comment, fridge_item, shopping_item, notice, notice_comment, expense, diary, habit, todo`

**헬퍼 함수**: `is_workspace_member(workspace_id)` (SECURITY DEFINER, workspace_member 자기 참조 재귀 회피용), `get_workspace_name(workspace_id)` (비멤버도 초대 링크 미리보기에서 워크스페이스 이름 확인 가능), `can_read_routine(member_id)`/`can_write_routine(member_id)` (2026-07-10 신규, SECURITY DEFINER — 루틴 RLS의 "본인 또는 managed 멤버" 조건을 재사용 가능하게 함수화)

**Storage**: `avatars` 버킷(퍼블릭) — 2026-07-07 신규. 경로 규칙 `avatars/{user_id}/{filename}`, 읽기는 공개, 쓰기(INSERT/UPDATE)는 `auth.uid() = 첫 폴더명`인 경우만 허용

**RLS 정책 요약**
- `family_workspace`: INSERT(로그인 유저 누구나) / SELECT·UPDATE(`is_workspace_member`)
- `users`: INSERT·SELECT·UPDATE 모두 `auth.uid() = id` — **본인 row만 조회 가능**. workspace_member와 join해서 다른 가족 구성원의 `avatar_color`/`avatar_text_color`/`avatar_image_url`를 가져오는 여러 화면(홈, 설정, 일정, 식탁, 게시판)에서 RLS 때문에 다른 사용자 필드가 비어 보일 가능성 있음 — **2026-07-07 기준 아직 미확인이며, 이번에 추가한 프로필 이미지 기능이 통째로 안 보일 수도 있는 원인** (아래 TODO 최우선 항목 참고)
- `workspace_member`: SELECT(같은 워크스페이스 멤버끼리, account/managed 구분 없이 전체). 2026-07-10부터 INSERT/UPDATE/DELETE는 `(member_type='account' AND user_id=auth.uid()) OR (member_type='managed' AND is_workspace_member(workspace_id))` — 본인 행 또는 같은 워크스페이스의 managed 멤버 행이면 허용(자녀 프로필 추가/수정/삭제). `(workspace_id, user_id)` UNIQUE는 `user_id IS NOT NULL`인 행에만 적용되는 partial index로 전환(2026-07-07 도입, 2026-07-10 전환)
- `routine`: 2026-07-10부터 `member_id` 기준(예전엔 `user_id`) — SELECT는 `can_read_routine()`(본인 루틴 + 같은 워크스페이스 managed 멤버 루틴), INSERT/UPDATE/DELETE는 `can_write_routine()`(본인 루틴 또는 managed 멤버 루틴, 둘 다 SECURITY DEFINER 헬퍼)
- `habit`: 개인 소유 (`user_id = auth.uid()`), workspace 무관
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
- [ ] `agent/` 서버는 아직 별도 배포 전(로컬 `python main.py`로만 실행) — Render 등에 배포 후 `NEXT_PUBLIC_AGENT_API_URL`과 `agent/.env`의 `ALLOWED_ORIGINS`를 실제 배포 도메인으로 갱신 필요. 이때 `agent/.env`와 Next.js `.env.local` 양쪽에 `AGENT_API_KEY`를 반드시 설정할 것(로컬 개발 중엔 미설정 상태라 인증이 생략되고 있음)
- [ ] 테마 선택값은 `localStorage`에만 저장됨(기기별 개별 적용) — 여러 기기 간 동기화가 필요해지면 `users.theme` 컬럼 추가 + 서버 액션으로 옮기는 마이그레이션 필요
- [ ] 홈 화면 태블릿(lg: 1024px~) 3단 컬럼 레이아웃은 코드로만 구현, 실제 태블릿/넓은 화면에서 육안 확인 안 됨 — 확인 필요
- [ ] Vercel 배포 여부 미확인
- [ ] 관리 멤버(자녀 등) 아바타는 색상 선택만 지원, 이미지 업로드는 미구현 — `avatars` Storage 버킷의 RLS(`auth.uid() = 첫 폴더명`)가 로그인한 본인 폴더에만 쓰기를 허용해서, 계정이 없는 관리 멤버 명의로 업로드하려면 정책을 별도로 손봐야 함(이번 범위에는 포함하지 않음)
- [ ] `supabase/add_diary_habit_todo_and_schedule_columns.sql`, `supabase/add_notice_comment_and_avatar_storage.sql`, `supabase/fix_author_policies.sql`, `supabase/add_share_token.sql`, `supabase/add_workspace_member_unique.sql`, `supabase/add_home_layout.sql`을 라이브 DB에 실행했는지 확인 필요 — 특히 `add_notice_comment_and_avatar_storage.sql`이 실행되어 있지 않으면 프로필 이미지 업로드가 실패함(2026-07-08에 에러 메시지를 구체화했으니 실패 시 화면에 실제 원인이 보일 것). `fix_author_policies.sql`/`add_share_token.sql`을 실행하기 전에는 코드리뷰로 고친 보안 이슈들이 앱 코드만으로는 절반만 막힌 상태(RLS는 여전히 예전 정책)임
- [ ] `regenerateShareToken`은 앱 코드에서 오너 여부를 확인하지만, `family_workspace`의 RLS `UPDATE` 정책은 여전히 `is_workspace_member`(멤버 전체 허용)라서 DB만 놓고 보면 오너가 아닌 멤버도 직접 API를 호출하면 공유 토큰을 바꿀 수 있음 — `meal`/`schedule`/`notice`에 적용한 것과 같은 방식으로 `family_workspace` UPDATE도 오너 전용 정책으로 분리할지 검토 필요 (이번 작업 범위에는 포함되지 않았음)
- [ ] Next.js Link의 `prefetch`는 기본값 그대로라 이미 켜져 있지만, 각 탭이 `requireWorkspaceContext()`로 매번 동적 렌더링을 하기 때문에 prefetch가 데이터까지 미리 가져오진 않음 — 탭 전환 체감 속도를 더 개선하려면 `loading.tsx` 스켈레톤 추가나 클라이언트 캐싱(SWR 등) 도입을 검토할 것 (이번엔 쿼리 병렬화까지만 진행)
- [ ] 2026-07-08 로그인 화면 재구성 + 자동 로그인: 이 환경엔 브라우저 자동화 도구가 없어 라이트/다크 스크린샷 검증과 "브라우저 완전 종료 후 재접속" 세션 유지/만료 테스트를 직접 하지 못했음 — `npx tsc --noEmit` 클린 + `next dev` 컴파일/라우트 상태코드(`/login` 200, `/home` 307)까지만 확인됨. 사용자가 직접 두 시나리오(체크 → 종료 → 재접속 시 `/home` 진입 / 체크 해제 → 종료 → 재접속 시 `/login`)를 브라우저에서 확인 필요
- [ ] `supabase/add_expense_source.sql`(`expense.source` 컬럼) 아직 라이브 DB에 미실행 — 실행 전까지는 `source` 컬럼을 쓰는 코드가 없어 기존 기능에 영향은 없음
- [ ] 2026-07-11 홈 화면 4위젯 재분할 + 100dvh 고정 + 장바구니 마이크/스와이프: 이 환경엔 로그인된 브라우저가 없어 `tsc --noEmit`/`next lint`/dev 서버 컴파일+라우트 상태코드까지만 확인됨. 실제 화면에서 직접 확인 필요한 것들 — ① 위젯 드래그 재정렬이 2행×2열로 자연스럽게 동작하는지, ② 다양한 화면 높이(특히 짧은 기기)에서 홈이 정말 스크롤 없이 한 화면에 들어가는지, ③ 장바구니 마이크 버튼이 실제 크롬/사파리에서 한국어 인식이 되는지, ④ 항목 행 스와이프 삭제의 제스처 임계값(56px)이 적당한지
- [ ] `supabase/add_expense_place.sql`(`expense.place` 컬럼 + 인덱스) 아직 라이브 DB에 미실행 — 실행 전까지는 "장보기 완료"가 실패함(`place` 컬럼이 없어 insert 에러)
- [ ] `supabase/add_meal_image.sql`(`meal-images` 버킷) 아직 라이브 DB에 미실행 — 실행 전까지는 끼니 이미지 삽입 시 업로드가 실패함(버킷이 없어 Storage 에러)
- [ ] `supabase/add_schedule_recurrence.sql`(`recur_type`/`recur_calendar`/`recur_until`) 아직 라이브 DB에 미실행 — 실행 전까지는 `createSchedule`의 insert 자체가 실패함(컬럼 없음 에러), "반복 없음"으로만 등록해도 마찬가지이니 화면 작업 전에 먼저 실행 필요
- [ ] 반복 일정 수정 화면 — `AddEventSheet`는 아직 신규 등록 전용이라 `updateSchedule` 액션이 없음. 가상 인스턴스를 열었을 때 "원본을 수정합니다" 안내 + `originalId` 라우팅, "이번 회만 수정"(P2) 전부 다음 작업에서 구현 예정 (`AddEventSheet.tsx` 상단 주석 참고)
- [ ] 반복 일정 데이터 레이어(`lunar.ts`/`recurrence.ts`/`getSchedulesForRange`)는 이 환경에서 Node로 직접 실행해 핵심 시나리오(월간 클램프, 윤년, 음력 왕복, `recur_until`, 기간유지, 원본중복없음)를 검증했지만, 로그인된 브라우저가 없어 실제 화면에서 월간/연간 뷰에 가상 인스턴스가 올바르게 섞여 보이는지는 확인 못 함 — 마이그레이션 실행 후 브라우저에서 직접 확인 필요
- [ ] 2026-07-11 장바구니 "장보기 완료" 폼 단순화 — 사용자가 준 UX 스펙(구매처/금액 두 입력만)을 그대로 따르면서, 기존에 있던 영수증 첨부 버튼과 "재고에 추가" on/off 토글을 이 폼에서 뺐음(재고 추가는 토글 없이 항상 실행). 스펙에 없던 기존 기능을 제거하는 판단이라 **사용자 확인 필요** — 영수증 첨부를 다시 이 폼에 넣거나 재고 추가를 다시 선택 가능하게 되돌리고 싶으면 알려줄 것. 이 환경엔 로그인된 브라우저가 없어 기록 탭의 달력/검색/상세 UI도 `tsc`/`lint`/컴파일 확인까지만 했고 실제 화면 확인은 못 함

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
  8. `supabase/add_managed_members.sql`
  9. `supabase/add_expense_source.sql`
  10. `supabase/add_expense_place.sql`
- ⚠️ 이 목록은 한동안 갱신되지 않아 그 사이 추가된 `add_shopping_expense_link.sql`/`add_meal_vote.sql`/`add_routine_enabled.sql`/`add_notice_image.sql`/`add_receipt_delete_policy.sql` 등은 빠져 있음 — 정확한 전체 목록은 위 디렉터리 구조의 `supabase/` 섹션과 파일별 "(실행 필요/완료)" 표시를 참고할 것
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
- `supabase/schema.sql`은 초기 스냅샷이며 현행 스키마는 마이그레이션 파일 + DB가 기준이다.
