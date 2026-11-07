-- +goose Up
ALTER TABLE availability_overrides ADD COLUMN notes TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE availability_overrides DROP COLUMN notes;
