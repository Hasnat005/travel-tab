-- Normalize legacy invite statuses (e.g. pending/accepted) to the reusable-link model.
-- New model expects: status IN ('active', 'revoked')

UPDATE "TripInvitation"
SET status = 'active'
WHERE status IS NULL OR status NOT IN ('active', 'revoked');
