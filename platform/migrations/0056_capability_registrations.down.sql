-- 0056 DOWN — drop the capability_registration table (forward-only discipline; ADR-005).
-- Rolling back DISCARDS all persisted tenant registrations (the OS can no longer re-hydrate them on the next
-- boot — tenants must re-POST /v1/capabilities). Only safe while no tenant relies on restart survival.
DROP TABLE IF EXISTS capability_registration;
