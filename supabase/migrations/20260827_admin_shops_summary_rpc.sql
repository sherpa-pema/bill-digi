-- ==============================================================================
-- DigiBill POS: Admin Shops Summary RPC & Accurate Bill Aggregation
-- Computes exact database bill counts and revenue totals directly in PostgreSQL,
-- completely eliminating PostgREST 1,000-row limits and cross-tenant RLS issues.
-- ==============================================================================

-- 1. Helper Function: Verify Admin Privilege
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
    (auth.jwt() ->> 'email' IN ('admin@digibill.app', 'sherpachungba3@gmail.com', 'admin@digibill.com')),
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE user_id = auth.uid() 
        AND is_admin = true
    ),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Create the get_admin_shops_summary() RPC function
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
    is_admin BOOLEAN,
    bill_count BIGINT,
    total_revenue NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    -- Ensure only administrators can execute this summary
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
        COALESCE(s.is_admin, false),
        COALESCE(COUNT(b.id), 0)::BIGINT AS bill_count,
        COALESCE(SUM(b.total_amount), 0)::NUMERIC AS total_revenue
    FROM public.shops s
    LEFT JOIN public.bills b ON b.shop_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_shops_summary() TO authenticated;

-- 3. Ensure RLS Policy for direct admin selection on bills table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bills' AND policyname = 'Admins select bills'
  ) THEN
    CREATE POLICY "Admins select bills"
      ON public.bills
      FOR SELECT
      TO authenticated
      USING (
        public.is_admin()
      );
  END IF;
END
$$;
