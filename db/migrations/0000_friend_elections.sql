CREATE TABLE election_rooms (
  code TEXT PRIMARY KEY NOT NULL,
  host_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE election_members (
  room_code TEXT NOT NULL REFERENCES election_rooms(code),
  member_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_code, member_id)
);
--> statement-breakpoint
CREATE INDEX election_members_by_user ON election_members (member_id, joined_at);
--> statement-breakpoint
CREATE TABLE room_elections (
  id TEXT PRIMARY KEY NOT NULL,
  room_code TEXT NOT NULL REFERENCES election_rooms(code),
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  closed_at INTEGER,
  winner TEXT CHECK (winner IN ('progressive','conservative')),
  electorate_size INTEGER NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX room_has_one_active_election ON room_elections(room_code) WHERE closed_at IS NULL;
--> statement-breakpoint
CREATE INDEX room_elections_by_date ON room_elections (room_code, starts_at);
--> statement-breakpoint
CREATE TABLE election_electorate (
  election_id TEXT NOT NULL REFERENCES room_elections(id),
  member_id TEXT NOT NULL,
  PRIMARY KEY (election_id, member_id)
);
--> statement-breakpoint
CREATE TABLE election_votes (
  election_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  candidate TEXT NOT NULL CHECK (candidate IN ('progressive','conservative')),
  cast_at INTEGER NOT NULL,
  PRIMARY KEY (election_id, member_id),
  FOREIGN KEY (election_id, member_id) REFERENCES election_electorate(election_id, member_id)
);
