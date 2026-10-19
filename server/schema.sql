CREATE TABLE IF NOT EXISTS ai_budget (
  day TEXT PRIMARY KEY,
  calls INTEGER NOT NULL CHECK (calls >= 0),
  minute INTEGER NOT NULL,
  minute_calls INTEGER NOT NULL CHECK (minute_calls >= 0)
);
