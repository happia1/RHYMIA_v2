-- fridge: 반복 일정(기념일·생신·연간행사) 지원 — schedule에 반복 규칙 컬럼 추가
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.
--
-- weekly(매주 반복)는 의도적으로 제외한다 — 매주 반복되는 일과는 "루틴"(routine 테이블)이
-- 전담하는 영역이라, schedule의 반복은 monthly/yearly 두 가지만 다룬다.

ALTER TABLE schedule ADD COLUMN IF NOT EXISTS recur_type TEXT NOT NULL DEFAULT 'none';
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS recur_calendar TEXT NOT NULL DEFAULT 'solar';
ALTER TABLE schedule ADD COLUMN IF NOT EXISTS recur_until DATE;

-- CHECK 제약은 ADD COLUMN처럼 IF NOT EXISTS를 못 쓰므로, 재실행 안전을 위해
-- pg_constraint를 직접 확인한 뒤에만 추가한다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_recur_type_check'
  ) THEN
    ALTER TABLE schedule ADD CONSTRAINT schedule_recur_type_check
      CHECK (recur_type IN ('none', 'monthly', 'yearly'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_recur_calendar_check'
  ) THEN
    ALTER TABLE schedule ADD CONSTRAINT schedule_recur_calendar_check
      CHECK (recur_calendar IN ('solar', 'lunar'));
  END IF;
END $$;

-- GRANT 확인: 새 테이블/새 정책이 아니라 기존 schedule 테이블에 컬럼만 추가하는
-- 마이그레이션이라 별도 GRANT는 필요 없다. schedule은 이미 fix_author_policies.sql에서
-- SELECT/INSERT/UPDATE/DELETE 정책이 갖춰져 있고, authenticated 롤 권한은 테이블 단위라
-- 새 컬럼도 자동으로 기존 권한 범위에 포함된다(add_managed_members.sql처럼 새 테이블을
-- 만들 때만 명시적 GRANT가 필요했던 것과 다름).
