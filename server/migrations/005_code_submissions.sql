CREATE TABLE winvero_code_submissions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
 verifier TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status='pending_review'),
 created_at TEXT NOT NULL
);
