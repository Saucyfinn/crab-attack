-- Funnel events from the game (worker/index.js → POST /api/event).
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  event TEXT NOT NULL,        -- first_open, round_cleared, purchase
  platform TEXT NOT NULL,     -- web, ios, android
  round INTEGER,
  value REAL,
  currency TEXT,
  mode TEXT,                  -- difficulty
  country TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  gclid TEXT,
  fbclid TEXT
);
CREATE INDEX events_by_day ON events (event, at);

-- Apple's copies of SKAdNetwork and AdAttributionKit install postbacks.
CREATE TABLE postbacks (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  kind TEXT NOT NULL,         -- skadnetwork, adattributionkit
  ad_network TEXT,
  source TEXT,                -- campaign / source identifier, when Apple's privacy threshold allows it
  conversion_value INTEGER,
  coarse_value TEXT,
  sequence INTEGER,
  body TEXT NOT NULL
);
