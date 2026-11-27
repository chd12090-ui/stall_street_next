CREATE TABLE server_election_resets (
  election_at INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  reset_id TEXT NOT NULL,
  PRIMARY KEY (election_at, member_id, reset_id)
) WITHOUT ROWID;
