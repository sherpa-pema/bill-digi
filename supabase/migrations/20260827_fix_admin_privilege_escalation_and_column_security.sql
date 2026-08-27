-- ==============================================================================
-- DigiBill POS: Fix Admin Privilege Escalation & Secure Multi-Tenant Architecture
-- ==============================================================================

-- 1. Create dedicated admin_users table for secure RBAC
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on admin_users
DROP POLICY IF EXISTS "Admins can select admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Deny all user modifications on admin_users" ON public.admin_users;

-- Read policy: Only verified admins or the specific admin user can view admin_users
CREATE POLICY "Admins can select admin_users"
    ON public.admin_users
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
        user_id = auth.uid()
    );

-- 2. Recreate secure is_admin() helper function
-- Strictly checks:
--   a) Server-signed custom claims in app_metadata (cannot be edited by client)
--   b) Existence in the protected public.admin_users table
-- NEVER checks user_metadata or client-updatable shops table columns.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean,
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'),
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE user_id = auth.uid()
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- 3. Column-Level Guardrail Triggers on public.shops
-- Prevents tenants from modifying is_admin, subscription tiers/expiry, or shop ownership.

CREATE OR REPLACE FUNCTION public.protect_shop_sensitive_columns()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If the caller is NOT a verified admin, prevent changing sensitive/privileged columns
    IF NOT public.is_admin() THEN
        -- Prevent mutating is_admin
        IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
            RAISE EXCEPTION 'Forbidden: You do not have permission to modify is_admin status.';
        END IF;

        -- Prevent self-granting subscription upgrades or changing status/expiry
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

-- Enforce safe defaults on INSERT for non-admins
CREATE OR REPLACE FUNCTION public.sanitize_shop_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        NEW.is_admin := false;
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

-- 4. Atomic Admin Subscription Management RPC
-- Allows administrators to safely activate Pro, extend trials, or revoke subscriptions
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
