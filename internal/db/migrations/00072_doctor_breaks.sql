-- +goose Up
CREATE TABLE IF NOT EXISTS doctor_breaks (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL CHECK (kind IN ('weekly', 'date')),
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    date        TEXT,
    start_time  TEXT NOT NULL,
    end_time    TEXT NOT NULL,
    title       TEXT NOT NULL DEFAULT 'Перерыв',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_doctor_breaks_user ON doctor_breaks(user_id);

-- +goose Down
DROP TABLE IF EXISTS doctor_breaks;
