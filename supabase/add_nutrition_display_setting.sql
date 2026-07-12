-- 끼니 영양 정보(추정) 표시 여부 — 워크스페이스 단위 설정, 기본 켜짐.
-- 끄면 끼니 카드/식탁 탭 하루 합계/끼니 상세의 영양 정보 섹션을 전부 숨긴다(추정 자체는 계속
-- 저장되고 값이 사라지지 않음 — 표시만 끄는 설정).
-- 재실행 안전.

ALTER TABLE family_workspace ADD COLUMN IF NOT EXISTS nutrition_display_enabled BOOLEAN DEFAULT true;
