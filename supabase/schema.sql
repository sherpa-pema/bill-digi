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
    shop_name TEXT,
    pan_number VARCHAR(9) CHECK (pan_number IS NULL OR pan_number ~ '^\d{9}$'),
    owner_name TEXT,
    email TEXT,
    phone TEXT,
    starting_bill_number BIGINT NOT NULL DEFAULT 1,
    next_bill_number BIGINT NOT NULL DEFAULT 1,
    vat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    discount_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 13.00 CHECK (vat_rate >= 0 AND vat_rate <= 100),
    discount_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (discount_rate >= 0 AND discount_rate <= 100),
    vat_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    simple_item_name TEXT NOT NULL DEFAULT 'General Item',
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'owner_name') THEN
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'vat_rate') THEN
        ALTER TABLE public.shops ADD COLUMN vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 13.00 CHECK (vat_rate >= 0 AND vat_rate <= 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'discount_rate') THEN
        ALTER TABLE public.shops ADD COLUMN discount_rate NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (discount_rate >= 0 AND discount_rate <= 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'vat_inclusive') THEN
        ALTER TABLE public.shops ADD COLUMN vat_inclusive BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'simple_item_name') THEN
        ALTER TABLE public.shops ADD COLUMN simple_item_name TEXT NOT NULL DEFAULT 'General Item';
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

    -- Ensure columns allow NULL until profile is completed
    ALTER TABLE shops ALTER COLUMN shop_name DROP NOT NULL;
    ALTER TABLE shops ALTER COLUMN pan_number DROP NOT NULL;

    -- Ensure 9-digit PAN format CHECK constraint exists and allows NULL
    ALTER TABLE shops DROP CONSTRAINT IF EXISTS chk_shops_pan_format;
    ALTER TABLE shops ADD CONSTRAINT chk_shops_pan_format CHECK (pan_number IS NULL OR pan_number ~ '^\d{9}$');

    -- Nullify placeholder PAN 123456789
    UPDATE public.shops SET pan_number = NULL WHERE pan_number = '123456789' OR pan_number !~ '^\d{9}$';
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
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
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
    shop_id TEXT REFERENCES shops(id) ON DELETE RESTRICT,
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

-- Ensure foreign key constraints on bills and subscription_payments enforce ON DELETE RESTRICT
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'bills' 
          AND kcu.column_name = 'shop_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.bills DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;

    FOR r IN (
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'subscription_payments' 
          AND kcu.column_name = 'shop_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.subscription_payments DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
EXCEPTION
    WHEN others THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bills_shop_id_fkey'
    ) THEN
        ALTER TABLE public.bills
            ADD CONSTRAINT bills_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_shop_id_fkey'
    ) THEN
        ALTER TABLE public.subscription_payments
            ADD CONSTRAINT subscription_payments_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE RESTRICT;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;

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

-- Non-admin tenants cannot delete shops (prevents bill/tax record destruction and trial manipulation).
-- Only verified administrators can delete shops (subject to ON DELETE RESTRICT on bills/subscription_payments).
DROP POLICY IF EXISTS "Users can delete own shop" ON shops;
DROP POLICY IF EXISTS "Admins can delete shops" ON shops;
CREATE POLICY "Admins can delete shops" 
ON shops FOR DELETE 
TO authenticated 
USING ((SELECT public.is_admin()));

-- Restrict direct UPDATE privileges on public.shops:
-- Prevents tenants from modifying next_bill_number, starting_bill_number, bill_count,
-- total_revenue, pan_number, user_id, or subscription columns directly via REST/SQL.
REVOKE UPDATE ON public.shops FROM authenticated;
REVOKE UPDATE ON public.shops FROM anon;
GRANT UPDATE (shop_name, owner_name, email, phone, vat_enabled, discount_enabled) ON public.shops TO authenticated;

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
    NEW.updated_at := NOW();

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
        -- Force trial expiry strictly to 7 days from now for non-admins, ignoring any client-supplied value
        NEW.trial_expires_at := NOW() + INTERVAL '7 days';
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
    -- Do not default to 'My Shop' or '123456789'
    v_shop_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'business_name'), '');
    v_pan_number := NULLIF(TRIM(NEW.raw_user_meta_data->>'pan_number'), '');
    
    -- Reject placeholder or invalid PAN in metadata: do NOT fallback to 123456789
    IF v_pan_number IS NOT NULL AND (v_pan_number !~ '^\d{9}$' OR v_pan_number = '123456789') THEN
        v_pan_number := NULL;
    END IF;

    v_owner_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'owner_name'), '');
    v_phone := COALESCE(NULLIF(TRIM(NEW.phone), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''));
    v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), NULLIF(TRIM(NEW.raw_user_meta_data->>'email'), ''));
    v_shop_id := 'shop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
    v_trial_expiry := NOW() + INTERVAL '7 days';

    -- Trigger is the SINGLE creator: insert with ON CONFLICT (user_id) DO NOTHING
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
-- Cleanly drop legacy 6-argument overload to prevent backdating exploit
DROP FUNCTION IF EXISTS public.create_bill_atomic(TEXT, TEXT, VARCHAR, NUMERIC, JSONB, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_shop_id TEXT,
    p_bill_id TEXT,
    p_bill_type VARCHAR(20),
    p_total_amount NUMERIC(12, 2),
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NULL,       -- Ignored to prevent client backdating; server enforces NOW()
    p_subtotal NUMERIC(12, 2) DEFAULT NULL,       -- Ignored: Server computes strictly from line items
    p_discount_amount NUMERIC(12, 2) DEFAULT NULL, -- Ignored: Server computes strictly from line items
    p_tax_amount NUMERIC(12, 2) DEFAULT NULL       -- Ignored: Server computes strictly from line items
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bill_number BIGINT;
    v_max_existing BIGINT;
    v_updated_shop shops%ROWTYPE;
    v_inserted_bill bills%ROWTYPE;
    v_caller_uid UUID;
    
    -- Integer Paisa Accumulators (1 NPR = 100 Paisa)
    p_total_paisa BIGINT;
    v_computed_total_paisa BIGINT := 0;
    v_computed_subtotal_paisa BIGINT := 0;
    v_computed_discount_paisa BIGINT := 0;
    v_computed_tax_paisa BIGINT := 0;
    
    v_item RECORD;
    v_item_count INTEGER;
    v_item_name TEXT;
    v_item_qty NUMERIC;
    v_item_price NUMERIC;
    v_item_line_total NUMERIC;
    v_item_kind TEXT;
    
    v_item_price_paisa BIGINT;
    v_item_line_total_paisa BIGINT;
    
    -- Shop Rates & Calculation Modes
    v_vat_rate NUMERIC(5, 2);
    v_discount_rate NUMERIC(5, 2);
    v_vat_inclusive BOOLEAN;
    v_taxable_base_paisa BIGINT;
    v_expected_discount_paisa BIGINT;
    v_expected_tax_paisa BIGINT;
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

    p_total_paisa := ROUND(p_total_amount * 100)::BIGINT;

    -- 3. Validate Items JSONB Payload Structure & Guard Against Storage Bloat
    IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'Invalid items payload: Expected JSON array.';
    END IF;

    IF octet_length(p_items::text) > 65536 THEN
        RAISE EXCEPTION 'Items payload exceeds maximum allowed size (64KB).';
    END IF;

    v_item_count := jsonb_array_length(p_items);
    IF v_item_count < 1 OR v_item_count > 200 THEN
        RAISE EXCEPTION 'Items array length must be between 1 and 200 items.';
    END IF;

    -- 4. Row-level lock on shop record to guarantee strictly serialized counter increment & fetch shop rates
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found', p_shop_id;
    END IF;

    -- 4a. Valid PAN Guard: Reject billing until a valid 9-digit PAN is set (not null, not placeholder 123456789)
    IF v_updated_shop.pan_number IS NULL OR TRIM(v_updated_shop.pan_number) = '' THEN
        RAISE EXCEPTION 'InvalidPanNumber: Billing is disabled until a valid 9-digit PAN number is configured in shop profile.'
            USING ERRCODE = 'P0004';
    END IF;

    IF v_updated_shop.pan_number !~ '^\d{9}$' THEN
        RAISE EXCEPTION 'InvalidPanNumber: Shop PAN number must be exactly 9 numeric digits.'
            USING ERRCODE = 'P0004';
    END IF;

    IF v_updated_shop.pan_number = '123456789' THEN
        RAISE EXCEPTION 'InvalidPanNumber: Billing is disabled under placeholder PAN 123456789. Please configure your registered 9-digit PAN in shop settings.'
            USING ERRCODE = 'P0004';
    END IF;

    -- 4b. Subscription & Trial Verification (Server-Authoritative Enforcement)
    IF NOT (SELECT public.is_admin()) THEN
        IF NOT (
            (v_updated_shop.subscription_tier = 'pro' AND 
             (v_updated_shop.subscription_expires_at IS NULL OR v_updated_shop.subscription_expires_at > NOW()))
            OR
            (COALESCE(v_updated_shop.trial_expires_at, v_updated_shop.created_at + INTERVAL '7 days') > NOW())
        ) THEN
            RAISE EXCEPTION 'SubscriptionExpired: Your 7-day trial or Pro subscription has expired. Please upgrade to continue billing.'
                USING ERRCODE = 'P0003';
        END IF;
    END IF;

    -- 4c. Load Rates Stored on Shop
    v_vat_rate := COALESCE(v_updated_shop.vat_rate, 13.00);
    v_discount_rate := COALESCE(v_updated_shop.discount_rate, 10.00);
    v_vat_inclusive := COALESCE(v_updated_shop.vat_inclusive, FALSE);

    -- 5. Validate Each Item Schema and Compute Integer Paisa Accumulators
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
        v_item_kind := LOWER(TRIM(COALESCE(v_item.kind, 'item')));

        -- Explicit Kind Enforcement: Only 'item', 'discount', or 'vat'
        IF v_item_kind NOT IN ('item', 'discount', 'vat') THEN
            RAISE EXCEPTION 'Invalid item kind "%" for item "%": Must be "item", "discount", or "vat".', v_item_kind, v_item_name;
        END IF;

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
        IF v_item_price < 0 AND v_item_kind != 'discount' THEN
            RAISE EXCEPTION 'Non-discount items cannot have a negative price: "%".', v_item_name;
        END IF;

        -- Discount items cannot have a positive line total
        IF v_item_line_total > 0 AND v_item_kind = 'discount' THEN
            RAISE EXCEPTION 'Discount item cannot have a positive line total: "%".', v_item_name;
        END IF;

        -- Integer Paisa representation of unit price and line total
        v_item_price_paisa := ROUND(v_item_price * 100)::BIGINT;
        v_item_line_total_paisa := ROUND(v_item_line_total * 100)::BIGINT;

        -- Verify line total calculation in integer paisa (line_total = qty * unit_price with 2 paisa tolerance)
        IF ABS(v_item_line_total_paisa - (v_item_qty * v_item_price_paisa)) > 2 THEN
            RAISE EXCEPTION 'Line total calculation mismatch for item "%".', v_item_name;
        END IF;

        -- Derive Breakdown Strictly from Explicit Kind (Never by item name string!)
        IF v_item_kind = 'discount' THEN
            v_computed_discount_paisa := v_computed_discount_paisa + ABS(v_item_line_total_paisa);
            v_computed_total_paisa := v_computed_total_paisa + v_item_line_total_paisa; -- negative addition decreases total
        ELSIF v_item_kind = 'vat' THEN
            v_computed_tax_paisa := v_computed_tax_paisa + v_item_line_total_paisa;
            IF NOT v_vat_inclusive THEN
                v_computed_total_paisa := v_computed_total_paisa + v_item_line_total_paisa;
            END IF;
        ELSE -- 'item'
            v_computed_subtotal_paisa := v_computed_subtotal_paisa + v_item_line_total_paisa;
            v_computed_total_paisa := v_computed_total_paisa + v_item_line_total_paisa;
        END IF;
    END LOOP;

    -- 6. Mathematical Recomputation Integrity Verification in Integer Paisa
    IF ABS(v_computed_total_paisa - p_total_paisa) > 2 THEN
        RAISE EXCEPTION 'Total amount mismatch: Recomputed sum (Rs %) does not match submitted total (Rs %).',
            (v_computed_total_paisa / 100.0), (p_total_paisa / 100.0);
    END IF;

    IF v_computed_total_paisa <= 0 THEN
        RAISE EXCEPTION 'Calculated bill total must be greater than zero.';
    END IF;

    -- 6c. Verify VAT and Discount against Rates Stored on Shop
    -- If a discount line was submitted, verify it aligns with shop's discount rate
    IF v_computed_discount_paisa > 0 AND v_computed_subtotal_paisa > 0 THEN
        v_expected_discount_paisa := ROUND((v_computed_subtotal_paisa * v_discount_rate) / 100.0)::BIGINT;
        IF ABS(v_computed_discount_paisa - v_expected_discount_paisa) > 5 THEN
            RAISE EXCEPTION 'Discount amount mismatch: Submitted Rs % does not match shop rate of % %% (expected Rs %).',
                (v_computed_discount_paisa / 100.0), v_discount_rate, (v_expected_discount_paisa / 100.0);
        END IF;
    END IF;

    -- If a VAT line was submitted, verify it aligns with shop's VAT rate and inclusive/exclusive mode
    IF v_computed_tax_paisa > 0 THEN
        v_taxable_base_paisa := v_computed_subtotal_paisa - v_computed_discount_paisa;
        IF v_vat_inclusive THEN
            -- In VAT-inclusive pricing (Retail MRP mode): VAT = TaxableBase * (rate / (100 + rate))
            v_expected_tax_paisa := ROUND((v_taxable_base_paisa * v_vat_rate) / (100.0 + v_vat_rate))::BIGINT;
        ELSE
            -- In VAT-exclusive pricing: VAT = TaxableBase * (rate / 100)
            v_expected_tax_paisa := ROUND((v_taxable_base_paisa * v_vat_rate) / 100.0)::BIGINT;
        END IF;

        IF ABS(v_computed_tax_paisa - v_expected_tax_paisa) > 5 THEN
            RAISE EXCEPTION 'VAT amount mismatch: Submitted Rs % does not match shop rate of % %% (expected Rs %).',
                (v_computed_tax_paisa / 100.0), v_vat_rate, (v_expected_tax_paisa / 100.0);
        END IF;
    END IF;

    -- 7. Self-Healing Monotonic Sequence Protection:
    SELECT COALESCE(MAX(bill_number) + 1, 1) INTO v_max_existing
    FROM public.bills
    WHERE shop_id = p_shop_id;

    v_bill_number := GREATEST(COALESCE(v_updated_shop.next_bill_number, 1), v_max_existing);

    -- Increment counter atomically with server timestamp NOW() and update shop metrics
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
        bill_count = COALESCE(bill_count, 0) + 1,
        total_revenue = COALESCE(total_revenue, 0) + ROUND(v_computed_total_paisa / 100.0, 2),
        updated_at = NOW()
    WHERE id = p_shop_id;

    -- Fetch refreshed shop state to return in payload
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id;

    -- 8. Insert bill record with server-calculated breakdown (Ignoring any client p_subtotal overrides)
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
        COALESCE(v_updated_shop.shop_name, 'Shop'),
        v_updated_shop.pan_number,
        v_bill_number,
        p_bill_type,
        ROUND(v_computed_total_paisa / 100.0, 2),
        ROUND(v_computed_subtotal_paisa / 100.0, 2),
        ROUND(v_computed_discount_paisa / 100.0, 2),
        ROUND(v_computed_tax_paisa / 100.0, 2),
        p_items,
        NOW()
    )
    RETURNING * INTO v_inserted_bill;

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

-- 8c. Dedicated Validated RPC to update Shop PAN Number
-- Strictly validates format (^\d{9}$) and checks caller authorization
CREATE OR REPLACE FUNCTION public.set_shop_pan_number(
    p_shop_id TEXT,
    p_pan_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_pan TEXT;
    v_updated_shop public.shops%ROWTYPE;
    v_caller_uid UUID;
BEGIN
    -- 1. Authorization check: caller must be authenticated and own this shop (or be an admin)
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: You must be logged in to update shop settings.';
    END IF;

    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Forbidden: You do not have permission to manage this shop.';
    END IF;

    -- 2. Validate input parameter: PAN must be exactly 9 numeric digits and not placeholder 123456789
    v_clean_pan := TRIM(COALESCE(p_pan_number, ''));
    IF v_clean_pan !~ '^\d{9}$' THEN
        RAISE EXCEPTION 'Invalid PAN number: PAN must be exactly 9 numeric digits.';
    END IF;

    IF v_clean_pan = '123456789' THEN
        RAISE EXCEPTION 'Invalid PAN number: Cannot use placeholder PAN 123456789. Please enter your registered 9-digit PAN.';
    END IF;

    -- 3. Lock and update shop record
    UPDATE public.shops
    SET pan_number = v_clean_pan,
        updated_at = NOW()
    WHERE id = p_shop_id
    RETURNING * INTO v_updated_shop;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found.', p_shop_id;
    END IF;

    RETURN to_jsonb(v_updated_shop);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_shop_pan_number(TEXT, TEXT) TO authenticated;

-- Dedicated Profile Completion RPC: Clients complete profile through one RPC
CREATE OR REPLACE FUNCTION public.complete_shop_profile(
    p_shop_name TEXT,
    p_pan_number TEXT,
    p_owner_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_shop_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_uid UUID;
    v_clean_name TEXT;
    v_clean_pan TEXT;
    v_target_shop_id TEXT;
    v_updated_shop public.shops%ROWTYPE;
BEGIN
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: You must be logged in to complete shop profile.';
    END IF;

    -- Validate shop name: required and non-empty
    v_clean_name := TRIM(COALESCE(p_shop_name, ''));
    IF length(v_clean_name) = 0 THEN
        RAISE EXCEPTION 'Invalid shop name: Shop name is required.';
    END IF;
    IF length(v_clean_name) > 120 THEN
        RAISE EXCEPTION 'Invalid shop name: Shop name cannot exceed 120 characters.';
    END IF;

    -- Validate PAN number: exactly 9 numeric digits, and NOT placeholder 123456789
    v_clean_pan := TRIM(COALESCE(p_pan_number, ''));
    IF v_clean_pan !~ '^\d{9}$' THEN
        RAISE EXCEPTION 'Invalid PAN number: PAN must be exactly 9 numeric digits.';
    END IF;
    IF v_clean_pan = '123456789' THEN
        RAISE EXCEPTION 'Invalid PAN number: Cannot use placeholder PAN 123456789. Please enter your registered 9-digit PAN.';
    END IF;

    -- Resolve shop ID: verify ownership or admin privileges
    IF p_shop_id IS NOT NULL AND TRIM(p_shop_id) != '' THEN
        IF NOT (
            public.is_admin() OR
            EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
        ) THEN
            RAISE EXCEPTION 'Forbidden: You do not have permission to manage this shop.';
        END IF;
        v_target_shop_id := p_shop_id;
    ELSE
        SELECT id INTO v_target_shop_id
        FROM public.shops
        WHERE user_id = v_caller_uid
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    -- If no shop exists for user (e.g. legacy account prior to trigger), provision safely
    IF v_target_shop_id IS NULL THEN
        v_target_shop_id := 'shop_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
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
            trial_expires_at,
            created_at,
            updated_at
        ) VALUES (
            v_target_shop_id,
            v_caller_uid,
            v_clean_name,
            v_clean_pan,
            NULLIF(TRIM(p_owner_name), ''),
            NULLIF(TRIM(p_email), ''),
            NULLIF(TRIM(p_phone), ''),
            1,
            1,
            'free',
            'trial',
            NOW(),
            NOW() + INTERVAL '7 days',
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            shop_name = EXCLUDED.shop_name,
            pan_number = EXCLUDED.pan_number,
            owner_name = COALESCE(EXCLUDED.owner_name, public.shops.owner_name),
            email = COALESCE(EXCLUDED.email, public.shops.email),
            phone = COALESCE(EXCLUDED.phone, public.shops.phone),
            updated_at = NOW()
        RETURNING * INTO v_updated_shop;

        RETURN to_jsonb(v_updated_shop);
    END IF;

    -- Atomically update shop profile in single operation
    UPDATE public.shops
    SET shop_name = v_clean_name,
        pan_number = v_clean_pan,
        owner_name = COALESCE(NULLIF(TRIM(p_owner_name), ''), owner_name),
        email = COALESCE(NULLIF(TRIM(p_email), ''), email),
        phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
        updated_at = NOW()
    WHERE id = v_target_shop_id
    RETURNING * INTO v_updated_shop;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found.', v_target_shop_id;
    END IF;

    RETURN to_jsonb(v_updated_shop);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_shop_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Function alias: complete_profile
CREATE OR REPLACE FUNCTION public.complete_profile(
    p_shop_name TEXT,
    p_pan_number TEXT,
    p_owner_name TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_shop_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.complete_shop_profile(p_shop_name, p_pan_number, p_owner_name, p_email, p_phone, p_shop_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Function alias: update_shop_pan_number
CREATE OR REPLACE FUNCTION public.update_shop_pan_number(
    p_shop_id TEXT,
    p_pan_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.set_shop_pan_number(p_shop_id, p_pan_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_shop_pan_number(TEXT, TEXT) TO authenticated;

-- 8d. Universal Server-Side Search for Shop Bills
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
    -- Guard: reject invalid, blank, or non-UUID inputs early to mitigate scanning and fuzzing
    IF p_bill_id IS NULL OR length(p_bill_id) > 64 OR p_bill_id !~ '^[0-9a-fA-F-]+$' THEN
        RETURN NULL;
    END IF;

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

    -- 3. Return sanitized public payload containing strictly receipt-relevant fields
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_bill),
        'shop', jsonb_build_object(
            'id', v_shop.id,
            'shop_name', COALESCE(v_bill.shop_name, v_shop.shop_name),
            'pan_number', COALESCE(v_bill.pan_number, v_shop.pan_number)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_bill(TEXT) TO authenticated;



