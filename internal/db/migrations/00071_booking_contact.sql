-- +goose Up
ALTER TABLE booking_attendees ADD COLUMN phone TEXT NOT NULL DEFAULT '';
ALTER TABLE booking_attendees ADD COLUMN contact_method TEXT NOT NULL DEFAULT 'email' CHECK (contact_method IN ('email', 'phone'));
ALTER TABLE event_types ADD COLUMN booking_contact_policy TEXT NOT NULL DEFAULT 'email_or_phone' CHECK (booking_contact_policy IN ('email_or_phone', 'phone_only', 'email_only'));
ALTER TABLE event_types ADD COLUMN default_contact_method TEXT NOT NULL DEFAULT 'phone' CHECK (default_contact_method IN ('email', 'phone'));
CREATE INDEX idx_booking_attendees_contact_phone ON booking_attendees(phone, booking_id) WHERE is_organizer = 1 AND phone != '';
CREATE INDEX idx_booking_attendees_contact_email ON booking_attendees(email COLLATE NOCASE, booking_id) WHERE is_organizer = 1 AND email != '';

-- +goose Down
-- Only use on disposable databases: older binaries cannot safely handle phone-only bookings.
DROP INDEX idx_booking_attendees_contact_phone;
DROP INDEX idx_booking_attendees_contact_email;
ALTER TABLE event_types DROP COLUMN default_contact_method;
ALTER TABLE event_types DROP COLUMN booking_contact_policy;
ALTER TABLE booking_attendees DROP COLUMN contact_method;
ALTER TABLE booking_attendees DROP COLUMN phone;
