-- +goose Up
-- 24-hour time is the default for everyone. Existing users move to it once (they can switch
-- back to 12-hour in their profile), and new users start on it: the column default stays
-- '12h' because SQLite cannot change a default in place, so a trigger corrects fresh rows.
UPDATE users SET time_format = '24h' WHERE time_format = '12h';

-- +goose StatementBegin
CREATE TRIGGER users_default_time_format_24h
AFTER INSERT ON users
WHEN NEW.time_format = '12h'
BEGIN
    UPDATE users SET time_format = '24h' WHERE id = NEW.id;
END;
-- +goose StatementEnd

-- +goose Down
DROP TRIGGER IF EXISTS users_default_time_format_24h;
