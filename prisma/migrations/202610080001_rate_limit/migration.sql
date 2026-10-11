BEGIN;
CREATE TABLE inventory."RateLimitBucket" (
  "scope" TEXT NOT NULL PRIMARY KEY,
  "windowStart" TIMESTAMPTZ(3) NOT NULL,
  "count" INTEGER NOT NULL CHECK ("count" >= 0),
  CONSTRAINT "RateLimitBucket_scope_check" CHECK ("scope" IN ('login', 'write', 'export'))
);
ALTER TABLE inventory."RateLimitBucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON inventory."RateLimitBucket" FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON inventory."RateLimitBucket" FROM %I', role_name);
    END IF;
  END LOOP;
END;
$$;
COMMIT;
