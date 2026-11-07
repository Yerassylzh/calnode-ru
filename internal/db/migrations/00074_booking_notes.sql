-- +goose Up
ALTER TABLE bookings ADD COLUMN notes TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE bookings DROP COLUMN notes;
