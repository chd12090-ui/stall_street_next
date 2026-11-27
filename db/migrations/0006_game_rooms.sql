ALTER TABLE friend_room_members ADD COLUMN nickname TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE server_election_votes ADD COLUMN room_code TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE INDEX server_votes_by_room ON server_election_votes(room_code,election_at);
