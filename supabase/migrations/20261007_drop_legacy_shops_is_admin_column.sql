-- ==============================================================================
-- Migration: Drop legacy shops.is_admin column and harden admin RPC verification
-- Date: 2026-10-07
-- Description:
--   1. Drop redundant legacy `shops.is_admin` column from `public.shops`.
--   2. Update `protect_shop_sensitive_columns()` trigger to remove references to `is_admin`.
--   3. Update `sanitize_shop_insert()` trigger to remove references to `is_admin`.
--   4. Recreate `get_admin_shops_summary()` RPC returning table without `is_admin`.
--   5. Recreate `public.is_admin()` SQL RPC with robust OR logic across app_metadata
--      and public.admin_users (by user_id or email).
-- ==============================================================================

-- 1. Recreate public.is_admin() helper
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

-- 2. Drop legacy is_admin column from shops
ALTER TABLE public.shops DROP COLUMN IF EXISTS is_admin;

-- 3. Update trigger: protect_shop_sensitive_columns
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

-- 4. Update trigger: sanitize_shop_insert
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

-- 5. Drop old get_admin_shops_summary (since return table signature changed) and recreate
DROP FUNCTION IF EXISTS public.get_admin_shops_summary();

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
    IF NOT public.is_admin() THEN
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
        COALESCE(COUNT(b.id), 0)::BIGINT AS bill_count,
        COALESCE(SUM(b.total_amount), 0)::NUMERIC AS total_revenue
    FROM public.shops s
    LEFT JOIN public.bills b ON b.shop_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_shops_summary() TO authenticated;
