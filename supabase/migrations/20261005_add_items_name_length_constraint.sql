-- ==============================================================================
-- DigiBill POS: Add Name Length and Validation Constraint on items Table (SEC-07)
-- Prevents whitespace-only item names and oversized payloads (DoS & database bloat)
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_name_length'
    ) THEN
        ALTER TABLE public.items 
        ADD CONSTRAINT chk_items_name_length 
        CHECK (length(trim(name)) >= 1 AND length(name) <= 120);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;
