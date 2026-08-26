-- ==============================================================================
-- DigiBill POS: Remove Admin Backdoor & Implement Secure Database-driven RBAC
-- ==============================================================================

-- 1. Create a secure SECURITY DEFINER helper function to verify admin rights
-- Checks:
--   a) Custom claim app_metadata.is_admin = true
--   b) User metadata user_metadata.is_admin = true
--   c) Database flag shops.is_admin = true for the authenticated user
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

-- Grant execution permission on the helper function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 2. Alter column default for activated_by on subscription_payments
ALTER TABLE IF EXISTS public.subscription_payments 
  ALTER COLUMN activated_by SET DEFAULT 'admin';

-- 3. Drop all legacy / insecure hardcoded email backdoor policies
DROP POLICY IF EXISTS "Admins have full access to shops" ON public.shops;
DROP POLICY IF EXISTS "Admins manage payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Admins manage subscription_payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Admins select bills" ON public.bills;
DROP POLICY IF EXISTS "Admins select items" ON public.items;

-- 4. Recreate secure, role-based RLS policies

-- SHOPS: Admins have full access; shop owners have full access to their own shop
CREATE POLICY "Admins have full access to shops"
  ON public.shops
  FOR ALL
  TO authenticated
  USING (
    public.is_admin() OR auth.uid() = user_id
  )
  WITH CHECK (
    public.is_admin() OR auth.uid() = user_id
  );

-- SUBSCRIPTION PAYMENTS: Admins can manage all payments; shop owners can view their own payment receipts
CREATE POLICY "Admins manage subscription_payments"
  ON public.subscription_payments
  FOR ALL
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.shops 
      WHERE public.shops.id = subscription_payments.shop_id 
        AND public.shops.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
  );

-- BILLS: Admins can select bills for cross-tenant dashboard metrics & analytics
CREATE POLICY "Admins select bills"
  ON public.bills
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
  );

-- ITEMS: Admins can select items for cross-tenant inventory auditing if needed
CREATE POLICY "Admins select items"
  ON public.items
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
  );
