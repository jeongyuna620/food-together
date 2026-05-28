-- ============================================================
-- 오늘 뭐먹지? — Supabase 스키마
-- Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요
-- ============================================================

-- 1. rooms
CREATE TABLE rooms (
  code          TEXT PRIMARY KEY,
  host_name     TEXT NOT NULL,
  status        TEXT DEFAULT 'waiting'
                  CHECK (status IN ('waiting', 'recommending', 'results')),
  recommendations JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. participants
CREATE TABLE participants (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code   TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  cant_eat    TEXT[] DEFAULT '{}',
  dont_want   TEXT[] DEFAULT '{}',
  budget      TEXT,
  lat         FLOAT,
  lng         FLOAT,
  completed   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. votes
CREATE TABLE votes (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code         TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  participant_name  TEXT NOT NULL,
  restaurant_name   TEXT NOT NULL,
  vote              TEXT NOT NULL CHECK (vote IN ('ok', 'no')),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (room_code, participant_name, restaurant_name)
);

-- ============================================================
-- Row Level Security — 개발용 (모두 허용)
-- 프로덕션에선 사용자 인증에 맞게 정책을 수정하세요
-- ============================================================
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_rooms"        ON rooms        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_participants" ON participants  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_votes"        ON votes         FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Realtime 활성화
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
