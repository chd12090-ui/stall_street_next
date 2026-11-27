CREATE TABLE friend_trading_snapshots (
  member_id TEXT PRIMARY KEY,
  captured_at INTEGER NOT NULL,
  positions TEXT NOT NULL,
  trades TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE friend_spy_reports (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL CHECK (recipient_id <> buyer_id),
  room_code TEXT NOT NULL,
  target_number INTEGER NOT NULL,
  cost INTEGER NOT NULL CHECK (cost >= 1000000),
  issued_at INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  positions TEXT NOT NULL,
  trades TEXT NOT NULL,
  notice_id TEXT NOT NULL UNIQUE,
  acknowledged_at INTEGER,
  FOREIGN KEY (room_code, buyer_id) REFERENCES friend_room_members(room_code, member_id),
  FOREIGN KEY (room_code, recipient_id) REFERENCES friend_room_members(room_code, member_id)
);
--> statement-breakpoint
CREATE INDEX spy_reports_inbox ON friend_spy_reports(recipient_id, acknowledged_at, issued_at);
--> statement-breakpoint
CREATE INDEX spy_reports_archive ON friend_spy_reports(buyer_id, issued_at DESC, id DESC);
