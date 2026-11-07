-- +goose Up
ALTER TABLE bookings ALTER COLUMN event_type_id DROP NOT NULL;

-- Staff who previously only had template-specific hours inherit their union.
INSERT INTO availability_rules (id, user_id, day_of_week, start_time, end_time)
SELECT lower(hex(randomblob(16))), user_id, day_of_week, start_time, end_time
FROM (
    SELECT DISTINCT r.user_id, r.day_of_week, r.start_time, r.end_time
    FROM availability_rules r
    WHERE r.event_type_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM availability_rules global
        WHERE global.user_id = r.user_id AND global.event_type_id IS NULL
    )
);

-- +goose Down
-- A downgrade must fail rather than discard appointments with no event type.
ALTER TABLE bookings ALTER COLUMN event_type_id SET NOT NULL;
