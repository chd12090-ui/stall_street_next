CREATE TABLE server_election_votes (
  election_at INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  candidate TEXT NOT NULL CHECK (candidate IN ('progressive','conservative')),
  cast_at INTEGER NOT NULL,
  PRIMARY KEY (election_at, member_id)
) WITHOUT ROWID;
