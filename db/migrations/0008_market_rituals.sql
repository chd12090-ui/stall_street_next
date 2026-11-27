CREATE TABLE market_rituals (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL REFERENCES friend_rooms(code),
  member_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  code TEXT NOT NULL,
  cost INTEGER NOT NULL,
  mental REAL NOT NULL,
  tick INTEGER NOT NULL,
  minute_offset INTEGER NOT NULL,
  strength INTEGER NOT NULL,
  success INTEGER NOT NULL,
  UNIQUE(room_code, request_id)
);
--> statement-breakpoint
CREATE INDEX market_rituals_news ON market_rituals(room_code, success, sequence);
