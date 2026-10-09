-- ==============================================================================
-- DIGITAL CHIT — SUPABASE DATABASE SCHEMA
-- Multi-Tenant Architecture with Strict Row Level Security (RLS) & Auth Triggers
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Shops / Businesses Table
CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    pan_number VARCHAR(9) NOT NULL,
    owner_name TEXT,
    email TEXT,
    phone TEXT,
    starting_bill_number BIGINT NOT NULL DEFAULT 1,
    next_bill_number BIGINT NOT NULL DEFAULT 1,
    vat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    discount_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_tier TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'trial',
    subscription_started_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_expires_at TIMESTAMPTZ,
    trial_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    bill_count BIGINT DEFAULT 0,
    total_revenue NUMERIC(14, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If table already exists in an earlier version, safely add/update missing columns & unique constraint:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'user_id') THEN
        ALTER TABLE shops ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'owner_name') THEN
        ALTER TABLE shops ADD COLUMN owner_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'email') THEN
        ALTER TABLE shops ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'phone') THEN
        ALTER TABLE shops ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'vat_enabled') THEN
        ALTER TABLE shops ADD COLUMN vat_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'discount_enabled') THEN
        ALTER TABLE shops ADD COLUMN discount_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'subscription_tier') THEN
        ALTER TABLE shops ADD COLUMN subscription_tier TEXT DEFAULT 'free';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'subscription_status') THEN
        ALTER TABLE shops ADD COLUMN subscription_status TEXT DEFAULT 'trial';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'subscription_started_at') THEN
        ALTER TABLE shops ADD COLUMN subscription_started_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'subscription_expires_at') THEN
        ALTER TABLE shops ADD COLUMN subscription_expires_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'trial_expires_at') THEN
        ALTER TABLE shops ADD COLUMN trial_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'bill_count') THEN
        ALTER TABLE shops ADD COLUMN bill_count BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'total_revenue') THEN
        ALTER TABLE shops ADD COLUMN total_revenue NUMERIC(14, 2) DEFAULT 0;
    END IF;

    -- Ensure unique constraint exists on user_id
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_shops_user_id') THEN
        ALTER TABLE shops ADD CONSTRAINT uq_shops_user_id UNIQUE (user_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;

-- 3. Inventory Items Table
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0 AND price <= 9999999.99),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bills / Invoices Table
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    shop_name TEXT,
    pan_number VARCHAR(9),
    bill_number BIGINT NOT NULL,
    bill_type VARCHAR(20) NOT NULL DEFAULT 'simple' CHECK (bill_type IN ('simple', 'itemized')),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount > 0 AND total_amount <= 99999999.99),
    subtotal NUMERIC(12, 2),
    discount_amount NUMERIC(12, 2) DEFAULT 0,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe update for existing bills table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'shop_name') THEN
        ALTER TABLE public.bills ADD COLUMN shop_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'pan_number') THEN
        ALTER TABLE public.bills ADD COLUMN pan_number VARCHAR(9);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'subtotal') THEN
        ALTER TABLE public.bills ADD COLUMN subtotal NUMERIC(12, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.bills ADD COLUMN discount_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bills' AND column_name = 'tax_amount') THEN
        ALTER TABLE public.bills ADD COLUMN tax_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;

    -- Backfill snapshotted shop details for existing bills from current shops table
    UPDATE public.bills b
    SET shop_name = s.shop_name,
        pan_number = s.pan_number
    FROM public.shops s
    WHERE b.shop_id = s.id
      AND (b.shop_name IS NULL OR b.pan_number IS NULL);
END $$;

-- Constraints: Ensure bill numbers are unique per shop and data rules
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_bills_shop_number'
    ) THEN
        ALTER TABLE bills ADD CONSTRAINT uq_bills_shop_number UNIQUE (shop_id, bill_number);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bills_total_amount'
    ) THEN
        ALTER TABLE bills ADD CONSTRAINT chk_bills_total_amount CHECK (total_amount > 0 AND total_amount <= 99999999.99);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bills_items_is_array'
    ) THEN
        ALTER TABLE bills ADD CONSTRAINT chk_bills_items_is_array CHECK (jsonb_typeof(items) = 'array');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_price'
    ) THEN
        ALTER TABLE items ADD CONSTRAINT chk_items_price CHECK (price >= 0 AND price <= 9999999.99);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_items_name_length'
    ) THEN
        ALTER TABLE items ADD CONSTRAINT chk_items_name_length CHECK (length(trim(name)) >= 1 AND length(name) <= 120);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;

-- 5. Subscription Payments Table
CREATE TABLE IF NOT EXISTS subscription_payments (
    id TEXT PRIMARY KEY,
    shop_id TEXT REFERENCES shops(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    pan_number TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 500,
    duration_days INTEGER NOT NULL DEFAULT 30,
    payment_method TEXT DEFAULT 'bank_qr',
    transaction_ref TEXT,
    activated_by TEXT DEFAULT 'admin',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Dedicated Admin Users Table (Protected RBAC)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Performance & RLS Query Indexes
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_pan ON shops(pan_number);
CREATE INDEX IF NOT EXISTS idx_items_shop ON items(shop_id);
CREATE INDEX IF NOT EXISTS idx_bills_shop_number ON bills(shop_id, bill_number DESC);
CREATE INDEX IF NOT EXISTS idx_bills_shop_created_at ON bills(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_shop ON subscription_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created ON subscription_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

-- 8. Admin Verification Helper Function (SECURITY DEFINER)
-- Strictly verifies server-controlled app_metadata or existence in public.admin_users.
-- Never checks client-editable user_metadata or tenant-editable shops columns.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid() OR (email IS NOT NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- 8. Row Level Security (RLS) Configuration
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Drop all old and permissive policies
DROP POLICY IF EXISTS "Allow public and authenticated access to shops" ON shops;
DROP POLICY IF EXISTS "Allow public and authenticated access to items" ON items;
DROP POLICY IF EXISTS "Allow public and authenticated access to bills" ON bills;
DROP POLICY IF EXISTS "Enable read/write for all" ON shops;
DROP POLICY IF EXISTS "Enable read/write for all" ON items;
DROP POLICY IF EXISTS "Enable read/write for all" ON bills;
DROP POLICY IF EXISTS "Public access policy" ON shops;
DROP POLICY IF EXISTS "Public access policy" ON items;
DROP POLICY IF EXISTS "Public access policy" ON bills;

DROP POLICY IF EXISTS "Users can select own shop" ON shops;
DROP POLICY IF EXISTS "Users can insert own shop" ON shops;
DROP POLICY IF EXISTS "Users can update own shop" ON shops;
DROP POLICY IF EXISTS "Users can delete own shop" ON shops;
DROP POLICY IF EXISTS "Admins have full access to shops" ON shops;

DROP POLICY IF EXISTS "Users can select items of own shops" ON items;
DROP POLICY IF EXISTS "Users can insert items to own shops" ON items;
DROP POLICY IF EXISTS "Users can update items in own shops" ON items;
DROP POLICY IF EXISTS "Users can delete items from own shops" ON items;
DROP POLICY IF EXISTS "Admins select items" ON items;

DROP POLICY IF EXISTS "Users can select bills of own shops" ON bills;
DROP POLICY IF EXISTS "Users can insert bills to own shops" ON bills;
DROP POLICY IF EXISTS "Users can update bills of own shops" ON bills;
DROP POLICY IF EXISTS "Users can delete bills of own shops" ON bills;
DROP POLICY IF EXISTS "Admins select bills" ON bills;

DROP POLICY IF EXISTS "Admins manage payments" ON subscription_payments;
DROP POLICY IF EXISTS "Admins manage subscription_payments" ON subscription_payments;
DROP POLICY IF EXISTS "Tenants and admins can view subscription payments" ON subscription_payments;
DROP POLICY IF EXISTS "Admins can insert subscription payments" ON subscription_payments;
DROP POLICY IF EXISTS "Admins can update subscription payments" ON subscription_payments;
DROP POLICY IF EXISTS "Admins can delete subscription payments" ON subscription_payments;

-- ------------------------------------------------------------------------------
-- SHOPS TABLE POLICIES (Multi-tenant isolation by user_id = auth.uid() + Admin access)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select own shop" 
ON shops FOR SELECT 
TO authenticated 
USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own shop" 
ON shops FOR INSERT 
TO authenticated 
WITH CHECK ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own shop" 
ON shops FOR UPDATE 
TO authenticated 
USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id) 
WITH CHECK ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own shop" 
ON shops FOR DELETE 
TO authenticated 
USING ((SELECT public.is_admin()) OR (SELECT auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- ITEMS TABLE POLICIES (Multi-tenant isolation by shop ownership + Admin select)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select items of own shops" 
ON items FOR SELECT 
TO authenticated 
USING (
    (SELECT public.is_admin()) OR
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can insert items to own shops" 
ON items FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can update items in own shops" 
ON items FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = (SELECT auth.uid())
    )
);

CREATE POLICY "Users can delete items from own shops" 
ON items FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = (SELECT auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- BILLS TABLE POLICIES (Multi-tenant isolation by shop ownership + Admin select)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select bills of own shops" 
ON bills FOR SELECT 
TO authenticated 
USING (
    (SELECT public.is_admin()) OR
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = bills.shop_id 
        AND shops.user_id = (SELECT auth.uid())
    )
);

-- (Note: Direct INSERT on bills is revoked for client REST calls. All bill creation
-- must occur exclusively through the SECURITY DEFINER function `create_bill_atomic`
-- to enforce server-side validation, price checks, and monotonic sequential numbering.
-- Bills are strictly immutable sales records - UPDATE and DELETE are disallowed to preserve ledger integrity)

-- ------------------------------------------------------------------------------
-- SUBSCRIPTION PAYMENTS POLICIES (Audit Ledger: Tenant read-only, Admin-only write)
-- ------------------------------------------------------------------------------
-- 1. SELECT policy: Tenants can view payment history for their own shops; admins can view all.
CREATE POLICY "Tenants and admins can view subscription payments"
ON subscription_payments FOR SELECT
TO authenticated
USING (
    (SELECT public.is_admin()) OR
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = subscription_payments.shop_id 
        AND shops.user_id = (SELECT auth.uid())
    )
);

-- 2. INSERT policy: Only administrators can create payment audit records.
CREATE POLICY "Admins can insert subscription payments"
ON subscription_payments FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT public.is_admin())
);

-- 3. UPDATE policy: Only administrators can update payment audit records.
CREATE POLICY "Admins can update subscription payments"
ON subscription_payments FOR UPDATE
TO authenticated
USING (
    (SELECT public.is_admin())
)
WITH CHECK (
    (SELECT public.is_admin())
);

-- 4. DELETE policy: Only administrators can delete payment audit records (preventing tenants from deleting payment history).
CREATE POLICY "Admins can delete subscription payments"
ON subscription_payments FOR DELETE
TO authenticated
USING (
    (SELECT public.is_admin())
);

-- ------------------------------------------------------------------------------
-- ADMIN USERS TABLE POLICIES (Protected RBAC)
-- ------------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can select admin_users" ON public.admin_users;
CREATE POLICY "Admins can select admin_users"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (
        (SELECT public.is_admin()) OR
        user_id = (SELECT auth.uid())
    );

-- ------------------------------------------------------------------------------
-- COLUMN GUARDRAIL TRIGGERS ON SHOPS TABLE
-- Prevents tenants from modifying subscription fields, or shop ownership
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_shop_sensitive_columns()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        -- Prevent changing subscription fields
        IF NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier OR
           NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
           NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at OR
           NEW.trial_expires_at IS DISTINCT FROM OLD.trial_expires_at THEN
            RAISE EXCEPTION 'Forbidden: Subscription tiers can only be modified by system administrators.';
        END IF;

        -- Prevent transferring shop ownership to another auth user
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Forbidden: Shop ownership cannot be transferred.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_shop_sensitive_columns ON public.shops;
CREATE TRIGGER trg_protect_shop_sensitive_columns
    BEFORE UPDATE ON public.shops
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_shop_sensitive_columns();

CREATE OR REPLACE FUNCTION public.sanitize_shop_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        NEW.subscription_tier := 'free';
        NEW.subscription_status := 'trial';
        NEW.subscription_expires_at := NULL;
        NEW.trial_expires_at := COALESCE(NEW.trial_expires_at, NOW() + INTERVAL '7 days');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_shop_insert ON public.shops;
CREATE TRIGGER trg_sanitize_shop_insert
    BEFORE INSERT ON public.shops
    FOR EACH ROW
    EXECUTE FUNCTION public.sanitize_shop_insert();

-- ------------------------------------------------------------------------------
-- 7. Automatic Shop Provisioning Trigger (Runs securely as SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_shop()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shop_name TEXT;
    v_pan_number TEXT;
    v_owner_name TEXT;
    v_phone TEXT;
    v_email TEXT;
    v_shop_id TEXT;
    v_trial_expiry TIMESTAMPTZ;
BEGIN
    v_shop_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), ''), 'My Shop');
    v_pan_number := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'pan_number'), ''), '123456789');
    v_owner_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), '');
    v_phone := COALESCE(NULLIF(TRIM(NEW.phone), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''));
    v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'email'), ''));
    v_shop_id := 'shop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    v_trial_expiry := NOW() + INTERVAL '7 days';

    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE user_id = NEW.id) THEN
        INSERT INTO public.shops (
            id,
            user_id,
            shop_name,
            pan_number,
            owner_name,
            email,
            phone,
            starting_bill_number,
            next_bill_number,
            subscription_tier,
            subscription_status,
            subscription_started_at,
            subscription_expires_at,
            trial_expires_at,
            created_at,
            updated_at
        ) VALUES (
            v_shop_id,
            NEW.id,
            v_shop_name,
            v_pan_number,
            v_owner_name,
            v_email,
            v_phone,
            1,
            1,
            'free',
            'trial',
            NOW(),
            NULL,
            v_trial_expiry,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_shop();

-- 8. Atomic Bill Generation Function (Eliminates Race Conditions & Verifies Math Server-Side)
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_shop_id TEXT,
    p_bill_id TEXT,
    p_bill_type VARCHAR(20),
    p_total_amount NUMERIC(12, 2),
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NULL, -- Ignored to prevent client backdating; server enforces NOW()
    p_subtotal NUMERIC(12, 2) DEFAULT NULL,
    p_discount_amount NUMERIC(12, 2) DEFAULT NULL,
    p_tax_amount NUMERIC(12, 2) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_number BIGINT;
    v_updated_shop shops%ROWTYPE;
    v_inserted_bill bills%ROWTYPE;
    v_caller_uid UUID;
    v_computed_total NUMERIC(12, 2) := 0;
    v_computed_subtotal NUMERIC(12, 2) := 0;
    v_computed_discount NUMERIC(12, 2) := 0;
    v_computed_tax NUMERIC(12, 2) := 0;
    v_item RECORD;
    v_item_count INTEGER;
    v_item_name TEXT;
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_item_line_total NUMERIC;
    v_item_kind TEXT;
BEGIN
    -- Security check: Ensure authenticated caller owns this shop or has admin privileges
    v_caller_uid := auth.uid();
    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to generate bills for this shop.';
    END IF;

    -- 0. Idempotency Check: If bill with this ID already exists for this shop, return it directly
    SELECT * INTO v_inserted_bill
    FROM public.bills
    WHERE id = p_bill_id AND shop_id = p_shop_id;

    IF FOUND THEN
        SELECT * INTO v_updated_shop
        FROM public.shops
        WHERE id = p_shop_id;

        RETURN jsonb_build_object(
            'bill', to_jsonb(v_inserted_bill),
            'shop', to_jsonb(v_updated_shop)
        );
    END IF;

    -- 1. Validate Bill Type
    IF p_bill_type IS NULL OR p_bill_type NOT IN ('simple', 'itemized') THEN
        RAISE EXCEPTION 'Invalid bill type: Must be "simple" or "itemized".';
    END IF;

    -- 2. Validate Total Amount Range
    IF p_total_amount IS NULL OR p_total_amount <= 0 OR p_total_amount > 99999999.99 THEN
        RAISE EXCEPTION 'Invalid total amount: Total must be between Rs 0.01 and Rs 99,999,999.99.';
    END IF;

    -- 3. Validate Items JSONB Payload Structure & Guard Against Storage Bloat
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Invalid items payload: Expected JSON array.';
    END IF;

    -- Guard against storage bloat & DoS payload (max 64KB JSON string)
    IF octet_length(p_items::text) > 65536 THEN
        RAISE EXCEPTION 'Items payload exceeds maximum allowed size (64KB).';
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count < 1 OR v_item_count > 200 THEN
        RAISE EXCEPTION 'Items array length must be between 1 and 200 items.';
    END IF;

    -- 4. Validate Each Item Schema and Price Boundaries
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        id TEXT,
        name TEXT,
        qty NUMERIC,
        unit_price NUMERIC,
        line_total NUMERIC,
        kind TEXT
    )
    LOOP
        v_item_name := TRIM(COALESCE(v_item.name, ''));
        v_item_qty := COALESCE(v_item.qty, 0);
        v_item_price := COALESCE(v_item.unit_price, 0);
        v_item_line_total := COALESCE(v_item.line_total, 0);
        v_item_kind := LOWER(TRIM(COALESCE(v_item.kind, '')));

        IF length(v_item_name) = 0 OR length(v_item_name) > 120 THEN
            RAISE EXCEPTION 'Invalid item name: Name must be between 1 and 120 characters.';
        END IF;

        IF v_item_qty < 1 OR v_item_qty > 99999 OR v_item_qty != ROUND(v_item_qty) THEN
            RAISE EXCEPTION 'Invalid quantity for item "%": Qty must be an integer between 1 and 99,999.', v_item_name;
        END IF;

        -- Price ceiling & floor check (-9,999,999.99 to 9,999,999.99)
        IF v_item_price < -9999999.99 OR v_item_price > 9999999.99 THEN
            RAISE EXCEPTION 'Unit price out of bounds for item "%".', v_item_name;
        END IF;

        -- Non-discount items cannot have a negative price
        IF v_item_price < 0 AND v_item_kind != 'discount' AND v_item_name NOT ILIKE 'discount%' THEN
            RAISE EXCEPTION 'Non-discount items cannot have a negative price: "%".', v_item_name;
        END IF;

        -- Verify line total calculation (line_total = qty * unit_price with 0.05 rounding tolerance)
        IF ABS(v_item_line_total - (v_item_qty * v_item_price)) > 0.05 THEN
            RAISE EXCEPTION 'Line total calculation mismatch for item "%".', v_item_name;
        END IF;

        -- Compute server-side breakdowns accurately
        IF v_item_kind = 'discount' OR v_item_price < 0 OR v_item_name ILIKE 'discount%' THEN
            v_computed_discount := v_computed_discount + ABS(v_item_line_total);
        ELSIF v_item_kind = 'vat' OR v_item_name ILIKE 'vat (%' OR v_item_name ILIKE 'vat' THEN
            v_computed_tax := v_computed_tax + v_item_line_total;
        ELSE
            v_computed_subtotal := v_computed_subtotal + v_item_line_total;
        END IF;

        v_computed_total := v_computed_total + v_item_line_total;
    END LOOP;

    -- 5. Mathematical Recomputation Integrity Verification
    IF ABS(v_computed_total - p_total_amount) > 0.05 THEN
        RAISE EXCEPTION 'Total amount mismatch: Recomputed sum (%) does not match submitted total (%).', v_computed_total, p_total_amount;
    END IF;

    IF v_computed_total <= 0 THEN
        RAISE EXCEPTION 'Calculated bill total must be greater than zero.';
    END IF;

    -- 6. Row-level lock on shop record to guarantee strictly serialized counter increment
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found', p_shop_id;
    END IF;

    -- Retrieve current counter (or fallback to 1)
    v_bill_number := COALESCE(v_updated_shop.next_bill_number, 1);

    -- Increment counter atomically with server timestamp NOW() and update shop metrics
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
        bill_count = COALESCE(bill_count, 0) + 1,
        total_revenue = COALESCE(total_revenue, 0) + ROUND(v_computed_total, 2),
        updated_at = NOW()
    WHERE id = p_shop_id
    RETURNING * INTO v_updated_shop;

    -- Insert the bill with the locked sequential number, snapshotted shop details, and server timestamp NOW()
    INSERT INTO public.bills (
        id,
        shop_id,
        shop_name,
        pan_number,
        bill_number,
        bill_type,
        total_amount,
        subtotal,
        discount_amount,
        tax_amount,
        items,
        created_at
    ) VALUES (
        p_bill_id,
        p_shop_id,
        v_updated_shop.shop_name,
        v_updated_shop.pan_number,
        v_bill_number,
        p_bill_type,
        ROUND(v_computed_total, 2),
        ROUND(COALESCE(p_subtotal, v_computed_subtotal), 2),
        ROUND(COALESCE(p_discount_amount, v_computed_discount), 2),
        ROUND(COALESCE(p_tax_amount, v_computed_tax), 2),
        p_items,
        NOW()
    )
    RETURNING * INTO v_inserted_bill;

    -- Return confirmed bill and updated shop payload
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_inserted_bill),
        'shop', to_jsonb(v_updated_shop)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bill_atomic(TEXT, TEXT, VARCHAR, NUMERIC, JSONB, TIMESTAMPTZ, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- 8b. Dedicated RPC to Safely Adjust Starting / Next Bill Counter
-- Strictly prevents stale-tab overwrites, regressions, and duplicate bill numbers.
CREATE OR REPLACE FUNCTION public.set_shop_starting_bill_number(
    p_shop_id TEXT,
    p_starting_bill_number BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_shop shops%ROWTYPE;
    v_max_existing_bill BIGINT;
    v_caller_uid UUID;
BEGIN
    -- 1. Security verification: caller must be shop owner or an admin
    v_caller_uid := auth.uid();
    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Forbidden: You do not have permission to manage this shop.';
    END IF;

    -- 2. Validate input parameter
    IF p_starting_bill_number IS NULL OR p_starting_bill_number < 1 THEN
        RAISE EXCEPTION 'Starting bill number must be at least 1.';
    END IF;

    -- 3. Lock shop record for update
    SELECT * INTO v_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found.', p_shop_id;
    END IF;

    -- 4. Check against existing generated bills for this shop
    SELECT COALESCE(MAX(bill_number), 0) INTO v_max_existing_bill
    FROM public.bills
    WHERE shop_id = p_shop_id;

    IF v_max_existing_bill > 0 AND p_starting_bill_number <= v_max_existing_bill THEN
        RAISE EXCEPTION 'Starting bill number (%) cannot be less than or equal to existing generated bill number (%).', p_starting_bill_number, v_max_existing_bill;
    END IF;

    -- 5. Atomically update starting_bill_number and ensure next_bill_number advances
    UPDATE public.shops
    SET starting_bill_number = p_starting_bill_number,
        next_bill_number = GREATEST(COALESCE(next_bill_number, 1), p_starting_bill_number),
        updated_at = NOW()
    WHERE id = p_shop_id
    RETURNING * INTO v_shop;

    RETURN to_jsonb(v_shop);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_shop_starting_bill_number(TEXT, BIGINT) TO authenticated;

-- 8c. Universal Server-Side Search for Shop Bills
-- Searches partial bill numbers, amounts, item names in JSONB, and bill types across all pages
CREATE OR REPLACE FUNCTION public.search_shop_bills(
    p_shop_id TEXT,
    p_query TEXT DEFAULT NULL,
    p_date_filter TEXT DEFAULT '30days',
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_query TEXT;
    v_today_start TIMESTAMPTZ;
    v_seven_days_ago TIMESTAMPTZ;
    v_thirty_days_ago TIMESTAMPTZ;
    v_total_count BIGINT;
    v_bills JSONB;
BEGIN
    -- 1. Security Check: caller must be owner of shop or admin
    IF NOT (
        (SELECT public.is_admin()) OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = (SELECT auth.uid()))
    ) THEN
        RAISE EXCEPTION 'Forbidden: You do not have permission to view bills for this shop.';
    END IF;

    v_clean_query := TRIM(COALESCE(p_query, ''));
    v_today_start := date_trunc('day', NOW());
    v_seven_days_ago := NOW() - INTERVAL '7 days';
    v_thirty_days_ago := NOW() - INTERVAL '30 days';

    WITH filtered AS (
        SELECT b.*
        FROM public.bills b
        WHERE b.shop_id = p_shop_id
          AND (
            p_start_date IS NOT NULL AND b.created_at >= p_start_date OR
            p_start_date IS NULL AND (
                p_date_filter = 'all' OR
                (p_date_filter = 'today' AND b.created_at >= v_today_start) OR
                (p_date_filter = '7days' AND b.created_at >= v_seven_days_ago) OR
                (p_date_filter = '30days' AND b.created_at >= v_thirty_days_ago) OR
                p_date_filter IS NULL
            )
          )
          AND (p_end_date IS NULL OR b.created_at <= p_end_date)
          AND (
            v_clean_query = '' OR
            b.bill_number::TEXT ILIKE '%' || v_clean_query || '%' OR
            b.total_amount::TEXT ILIKE '%' || v_clean_query || '%' OR
            b.bill_type ILIKE '%' || v_clean_query || '%' OR
            b.items::TEXT ILIKE '%' || v_clean_query || '%'
          )
    ),
    counted AS (
        SELECT COUNT(*) AS total_count FROM filtered
    ),
    sliced AS (
        SELECT * FROM filtered
        ORDER BY bill_number DESC
        LIMIT GREATEST(1, p_limit) + 1
        OFFSET GREATEST(0, p_offset)
    )
    SELECT 
        (SELECT total_count FROM counted),
        COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.bill_number DESC), '[]'::jsonb)
    INTO v_total_count, v_bills
    FROM sliced s;

    RETURN jsonb_build_object(
        'bills', CASE 
            WHEN jsonb_array_length(v_bills) > p_limit 
            THEN v_bills - (jsonb_array_length(v_bills) - 1)::int 
            ELSE v_bills 
        END,
        'has_more', (jsonb_array_length(v_bills) > p_limit),
        'total_count', COALESCE(v_total_count, 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_shop_bills(TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INT, INT) TO authenticated;

-- 9. Admin Shops Overview & Fast Metric Summary Function (Zero-join O(1) query)
CREATE OR REPLACE FUNCTION public.get_admin_shops_summary()
RETURNS TABLE (
    id TEXT,
    user_id UUID,
    shop_name TEXT,
    pan_number TEXT,
    owner_name TEXT,
    email TEXT,
    phone TEXT,
    starting_bill_number BIGINT,
    next_bill_number BIGINT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    subscription_tier TEXT,
    subscription_status TEXT,
    subscription_started_at TIMESTAMPTZ,
    subscription_expires_at TIMESTAMPTZ,
    trial_expires_at TIMESTAMPTZ,
    bill_count BIGINT,
    total_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT (SELECT public.is_admin()) THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can view the cross-tenant shop summary.';
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        s.shop_name,
        s.pan_number,
        s.owner_name,
        s.email,
        s.phone,
        COALESCE(s.starting_bill_number, 1)::BIGINT,
        COALESCE(s.next_bill_number, 1)::BIGINT,
        s.created_at,
        s.updated_at,
        COALESCE(s.subscription_tier, 'free')::TEXT,
        COALESCE(s.subscription_status, 'trial')::TEXT,
        s.subscription_started_at,
        s.subscription_expires_at,
        s.trial_expires_at,
        COALESCE(s.bill_count, GREATEST(0, s.next_bill_number - s.starting_bill_number), 0)::BIGINT AS bill_count,
        COALESCE(s.total_revenue, 0)::NUMERIC AS total_revenue
    FROM public.shops s
    ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_shops_summary() TO authenticated;

-- 11. Atomic Admin Subscription Management RPC
CREATE OR REPLACE FUNCTION public.admin_set_shop_subscription(
    p_shop_id TEXT,
    p_tier TEXT,
    p_status TEXT,
    p_duration_days INTEGER DEFAULT 30,
    p_amount NUMERIC DEFAULT 500,
    p_payment_method TEXT DEFAULT 'bank_qr',
    p_transaction_ref TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_activated_by TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_shop shops%ROWTYPE;
    v_base_time TIMESTAMPTZ;
    v_new_expiry TIMESTAMPTZ;
    v_payment_id TEXT;
    v_payment subscription_payments%ROWTYPE;
BEGIN
    -- Strict authorization check
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only system administrators can manage shop subscriptions.';
    END IF;

    -- Fetch target shop with row lock
    SELECT * INTO v_target_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found', p_shop_id;
    END IF;

    -- Calculate appropriate expiry dates based on action
    IF p_tier = 'pro' AND p_status = 'active' THEN
        IF v_target_shop.subscription_tier = 'pro' AND v_target_shop.subscription_expires_at > NOW() THEN
            v_base_time := v_target_shop.subscription_expires_at;
        ELSE
            v_base_time := NOW();
        END IF;
        v_new_expiry := v_base_time + (p_duration_days || ' days')::INTERVAL;

        UPDATE public.shops
        SET subscription_tier = 'pro',
            subscription_status = 'active',
            subscription_started_at = COALESCE(subscription_started_at, NOW()),
            subscription_expires_at = v_new_expiry,
            updated_at = NOW()
        WHERE id = p_shop_id
        RETURNING * INTO v_target_shop;

        -- Record payment log
        v_payment_id := 'pay_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
        INSERT INTO public.subscription_payments (
            id,
            shop_id,
            shop_name,
            pan_number,
            amount,
            duration_days,
            payment_method,
            transaction_ref,
            activated_by,
            notes,
            created_at
        ) VALUES (
            v_payment_id,
            v_target_shop.id,
            v_target_shop.shop_name,
            v_target_shop.pan_number,
            p_amount,
            p_duration_days,
            p_payment_method,
            p_transaction_ref,
            p_activated_by,
            p_notes,
            NOW()
        )
        RETURNING * INTO v_payment;

    ELSIF p_status = 'trial' THEN
        v_base_time := COALESCE(v_target_shop.trial_expires_at, NOW());
        IF v_base_time < NOW() THEN
            v_base_time := NOW();
        END IF;
        v_new_expiry := v_base_time + (p_duration_days || ' days')::INTERVAL;

        UPDATE public.shops
        SET subscription_tier = 'free',
            subscription_status = 'trial',
            trial_expires_at = v_new_expiry,
            updated_at = NOW()
        WHERE id = p_shop_id
        RETURNING * INTO v_target_shop;

    ELSE
        -- Downgrade / Expired
        v_new_expiry := NOW() - INTERVAL '1 second';

        UPDATE public.shops
        SET subscription_tier = 'free',
            subscription_status = 'expired',
            subscription_expires_at = v_new_expiry,
            trial_expires_at = v_new_expiry,
            updated_at = NOW()
        WHERE id = p_shop_id
        RETURNING * INTO v_target_shop;
    END IF;

    RETURN jsonb_build_object(
        'shop', to_jsonb(v_target_shop),
        'payment', to_jsonb(v_payment)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_shop_subscription(TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 12. Public Bill Sharing Stored Procedure
CREATE OR REPLACE FUNCTION public.get_public_bill(p_bill_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill bills%ROWTYPE;
    v_shop shops%ROWTYPE;
BEGIN
    -- 1. Fetch bill by ID
    SELECT * INTO v_bill
    FROM public.bills
    WHERE id = p_bill_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 2. Fetch associated shop
    SELECT * INTO v_shop
    FROM public.shops
    WHERE id = v_bill.shop_id;

    -- 3. Return sanitized public payload with snapshotted shop details
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_bill),
        'shop', jsonb_build_object(
            'id', v_shop.id,
            'shop_name', COALESCE(v_bill.shop_name, v_shop.shop_name),
            'pan_number', COALESCE(v_bill.pan_number, v_shop.pan_number),
            'phone', v_shop.phone,
            'email', v_shop.email,
            'starting_bill_number', v_shop.starting_bill_number,
            'next_bill_number', v_shop.next_bill_number,
            'created_at', v_shop.created_at,
            'updated_at', v_shop.updated_at
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO authenticated;



