ALTER TABLE friend_rooms ADD COLUMN game_mode TEXT
  CHECK (game_mode IN ('multiplayer','guest'));
--> statement-breakpoint
ALTER TABLE friend_rooms ADD COLUMN started_at INTEGER;
