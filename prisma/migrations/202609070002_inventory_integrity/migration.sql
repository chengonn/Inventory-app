BEGIN;

-- SQL-only invariants: Prisma's schema cannot express CHECK/RLS/trigger rules.
ALTER TABLE inventory."Item" ADD CONSTRAINT "Item_safety_nonnegative"
  CHECK ("safetyStock" IS NULL OR ("safetyStock" >= 0 AND "safetyStock" <> 'NaN'::numeric));

ALTER TABLE inventory."OpeningInventory" ADD CONSTRAINT "OpeningInventory_status_quantity"
  CHECK (
    ("status" = 'CONFIRMED' AND "normalizedQty" IS NOT NULL AND "normalizedQty" >= 0 AND "normalizedQty" <> 'NaN'::numeric)
    OR ("status" = 'NEEDS_REVIEW' AND "normalizedQty" IS NULL)
    OR ("status" = 'IGNORED' AND ("normalizedQty" IS NULL OR ("normalizedQty" >= 0 AND "normalizedQty" <> 'NaN'::numeric)))
  );

ALTER TABLE inventory."StockMove" ADD CONSTRAINT "StockMove_status_quantity"
  CHECK (
    ("status" = 'CONFIRMED' AND "normalizedQty" IS NOT NULL AND "signedQty" IS NOT NULL
      AND "normalizedQty" >= 0 AND "normalizedQty" <> 'NaN'::numeric
      AND (("type" IN ('IN', 'ADJUST_GAIN') AND "signedQty" = "normalizedQty")
        OR ("type" IN ('OUT', 'ADJUST_LOSS') AND "signedQty" = -"normalizedQty")
        OR ("type" = 'REVERSAL' AND abs("signedQty") = "normalizedQty")))
    OR ("status" = 'NEEDS_REVIEW' AND "normalizedQty" IS NULL AND "signedQty" IS NULL)
    OR ("status" = 'IGNORED' AND ("signedQty" IS NULL OR "signedQty" <> 'NaN'::numeric)
      AND ("normalizedQty" IS NULL OR ("normalizedQty" >= 0 AND "normalizedQty" <> 'NaN'::numeric)))
  );

ALTER TABLE inventory."StockMove" ADD CONSTRAINT "StockMove_reversal_reference"
  CHECK (("type" = 'REVERSAL' AND "status" = 'CONFIRMED' AND "reversalOfMoveId" IS NOT NULL AND "reversalOfMoveId" <> "id")
    OR ("type" <> 'REVERSAL' AND "reversalOfMoveId" IS NULL));

ALTER TABLE inventory."ImportBatch" ADD CONSTRAINT "ImportBatch_sha256"
  CHECK ("fileHash" ~ '^[0-9a-f]{64}$');

CREATE FUNCTION inventory.protect_stock_move_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'StockMove history cannot be deleted; use reversal' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" = 'CONFIRMED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Confirmed StockMove is immutable; use reversal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "StockMove_preserve_rows" BEFORE UPDATE OR DELETE ON inventory."StockMove"
  FOR EACH ROW EXECUTE FUNCTION inventory.protect_stock_move_history();
CREATE TRIGGER "StockMove_no_truncate" BEFORE TRUNCATE ON inventory."StockMove"
  FOR EACH STATEMENT EXECUTE FUNCTION inventory.protect_stock_move_history();

-- No business schema access for browser roles. Auth's schema is untouched.
REVOKE ALL ON SCHEMA inventory FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA inventory FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA inventory FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inventory FROM PUBLIC;

DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA inventory FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA inventory FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA inventory FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inventory FROM %I', role_name);
    END IF;
  END LOOP;
END;
$$;

ALTER TABLE inventory."Item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory."Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory."OpeningInventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory."StockMove" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory."ArchivedRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory."ImportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory."AuditLog" ENABLE ROW LEVEL SECURITY;
-- No browser RLS policies. Server Prisma uses the table-owning DB role.

COMMIT;
