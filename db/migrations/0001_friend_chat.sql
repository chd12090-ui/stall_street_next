CREATE TABLE friend_rooms (
  code TEXT PRIMARY KEY,
  host_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE friend_room_members (
  room_code TEXT NOT NULL REFERENCES friend_rooms(code),
  member_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  visited_at INTEGER NOT NULL,
  PRIMARY KEY (room_code, member_id)
);
--> statement-breakpoint
CREATE INDEX friend_chat_recent_room ON friend_room_members(member_id, visited_at DESC);
--> statement-breakpoint
CREATE TABLE friend_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_code TEXT NOT NULL,
  author_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text','news','stock','market','assets')),
  content TEXT NOT NULL CHECK(length(content) <= 600),
  amount INTEGER,
  sent_at INTEGER NOT NULL,
  UNIQUE (room_code, author_id, nonce),
  FOREIGN KEY (room_code, author_id) REFERENCES friend_room_members(room_code, member_id)
);
--> statement-breakpoint
CREATE INDEX friend_chat_room_messages ON friend_messages(room_code, id DESC);
