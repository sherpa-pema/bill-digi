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
    subscription_tier TEXT DEFAULT 'free',
    subscription_status TEXT DEFAULT 'trial',
    subscription_started_at TIMESTAMPTZ DEFAULT NOW(),
    subscription_expires_at TIMESTAMPTZ,
    trial_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    is_admin BOOLEAN DEFAULT FALSE,
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'is_admin') THEN
        ALTER TABLE shops ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
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
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bills / Invoices Table
CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    bill_number BIGINT NOT NULL,
    bill_type VARCHAR(20) NOT NULL DEFAULT 'simple', -- 'simple' | 'itemized'
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: Ensure bill numbers are unique per shop
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_bills_shop_number'
    ) THEN
        ALTER TABLE bills ADD CONSTRAINT uq_bills_shop_number UNIQUE (shop_id, bill_number);
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

-- 6. Performance & RLS Query Indexes
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON shops(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_pan ON shops(pan_number);
CREATE INDEX IF NOT EXISTS idx_items_shop ON items(shop_id);
CREATE INDEX IF NOT EXISTS idx_bills_shop_number ON bills(shop_id, bill_number DESC);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_shop ON subscription_payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created ON subscription_payments(created_at DESC);

-- 7. Admin Verification Helper Function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    (auth.jwt() -> 'user_metadata' ->> 'is_admin')::boolean,
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE user_id = auth.uid() 
        AND is_admin = true
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

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

-- ------------------------------------------------------------------------------
-- SHOPS TABLE POLICIES (Multi-tenant isolation by user_id = auth.uid() + Admin access)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select own shop" 
ON shops FOR SELECT 
TO authenticated 
USING (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Users can insert own shop" 
ON shops FOR INSERT 
TO authenticated 
WITH CHECK (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Users can update own shop" 
ON shops FOR UPDATE 
TO authenticated 
USING (public.is_admin() OR auth.uid() = user_id) 
WITH CHECK (public.is_admin() OR auth.uid() = user_id);

CREATE POLICY "Users can delete own shop" 
ON shops FOR DELETE 
TO authenticated 
USING (public.is_admin() OR auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- ITEMS TABLE POLICIES (Multi-tenant isolation by shop ownership + Admin select)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select items of own shops" 
ON items FOR SELECT 
TO authenticated 
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert items to own shops" 
ON items FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update items in own shops" 
ON items FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete items from own shops" 
ON items FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = items.shop_id 
        AND shops.user_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- BILLS TABLE POLICIES (Multi-tenant isolation by shop ownership + Admin select)
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can select bills of own shops" 
ON bills FOR SELECT 
TO authenticated 
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = bills.shop_id 
        AND shops.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert bills to own shops" 
ON bills FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = bills.shop_id 
        AND shops.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update bills of own shops" 
ON bills FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = bills.shop_id 
        AND shops.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = bills.shop_id 
        AND shops.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete bills of own shops" 
ON bills FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = bills.shop_id 
        AND shops.user_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- SUBSCRIPTION PAYMENTS POLICIES (Admin management + tenant view)
-- ------------------------------------------------------------------------------
CREATE POLICY "Admins manage subscription_payments"
ON subscription_payments FOR ALL
TO authenticated
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM shops 
        WHERE shops.id = subscription_payments.shop_id 
        AND shops.user_id = auth.uid()
    )
)
WITH CHECK (
    public.is_admin()
);

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

-- 8. Atomic Bill Generation Function (Eliminates TOCTOU Race Conditions)
CREATE OR REPLACE FUNCTION public.create_bill_atomic(
    p_shop_id TEXT,
    p_bill_id TEXT,
    p_bill_type VARCHAR(20),
    p_total_amount NUMERIC(12, 2),
    p_items JSONB,
    p_created_at TIMESTAMPTZ DEFAULT NOW()
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
BEGIN
    -- Security check: Ensure authenticated caller owns this shop or has admin privileges
    v_caller_uid := auth.uid();
    IF NOT (
        public.is_admin() OR 
        EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND user_id = v_caller_uid)
    ) THEN
        RAISE EXCEPTION 'Unauthorized: You do not have permission to generate bills for this shop.';
    END IF;

    -- Row-level lock on shop record to guarantee strictly serialized counter increment
    SELECT * INTO v_updated_shop
    FROM public.shops
    WHERE id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shop with ID % not found', p_shop_id;
    END IF;

    -- Retrieve current counter (or fallback to 1)
    v_bill_number := COALESCE(v_updated_shop.next_bill_number, 1);

    -- Increment counter atomically
    UPDATE public.shops
    SET next_bill_number = v_bill_number + 1,
        updated_at = p_created_at
    WHERE id = p_shop_id
    RETURNING * INTO v_updated_shop;

    -- Insert the bill with the locked sequential number
    INSERT INTO public.bills (
        id,
        shop_id,
        bill_number,
        bill_type,
        total_amount,
        items,
        created_at
    ) VALUES (
        p_bill_id,
        p_shop_id,
        v_bill_number,
        p_bill_type,
        p_total_amount,
        p_items,
        p_created_at
    )
    RETURNING * INTO v_inserted_bill;

    -- Return confirmed bill and updated shop payload
    RETURN jsonb_build_object(
        'bill', to_jsonb(v_inserted_bill),
        'shop', to_jsonb(v_updated_shop)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bill_atomic(TEXT, TEXT, VARCHAR, NUMERIC, JSONB, TIMESTAMPTZ) TO authenticated;

-- 9. Realtime Publications
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE shops, items, bills;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_object THEN NULL;
    END;
END $$;
