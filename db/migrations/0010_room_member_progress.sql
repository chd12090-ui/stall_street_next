CREATE TABLE room_member_progress (
  room_code TEXT NOT NULL,
  member_id TEXT NOT NULL PRIMARY KEY,
  reset_id TEXT NOT NULL,
  ritual_floor INTEGER NOT NULL,
  ritual_repair_id TEXT NOT NULL DEFAULT '',
  intimidation_floor INTEGER NOT NULL,
  spy_floor INTEGER NOT NULL,
  FOREIGN KEY (room_code,member_id) REFERENCES friend_room_members(room_code,member_id)
);
--> statement-breakpoint
ALTER TABLE market_rituals ADD COLUMN progress_aware INTEGER NOT NULL DEFAULT 0;
