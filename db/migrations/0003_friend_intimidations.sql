CREATE TABLE friend_intimidations (
  id TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  room_code TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL CHECK (recipient_id <> sender_id),
  cost INTEGER NOT NULL CHECK (cost >= 2000000),
  created_at INTEGER NOT NULL,
  game_at INTEGER NOT NULL,
  game_day INTEGER NOT NULL,
  acknowledged_at INTEGER,
  UNIQUE (sender_id, nonce),
  FOREIGN KEY (room_code, sender_id) REFERENCES friend_room_members(room_code, member_id),
  FOREIGN KEY (room_code, recipient_id) REFERENCES friend_room_members(room_code, member_id)
);
--> statement-breakpoint
CREATE INDEX intimidation_sender_cooldown ON friend_intimidations(sender_id, game_at DESC);
--> statement-breakpoint
CREATE INDEX intimidation_recipient_pending ON friend_intimidations(recipient_id, acknowledged_at, created_at);
