-- fridge: 일정 반복 주기에 "매주" 추가 — add_schedule_recurrence.sql이 의도적으로 뺐던
-- weekly(당시엔 "루틴이 전담하는 영역"으로 판단)를 다시 허용한다.
-- Supabase SQL Editor에서 실행하세요. 재실행해도 안전합니다.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedule_recur_type_check'
  ) THEN
    ALTER TABLE schedule DROP CONSTRAINT schedule_recur_type_check;
  END IF;

  ALTER TABLE schedule ADD CONSTRAINT schedule_recur_type_check
    CHECK (recur_type IN ('none', 'weekly', 'monthly', 'yearly'));
END $$;
