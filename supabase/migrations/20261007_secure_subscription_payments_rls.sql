-- ==============================================================================
-- Migration: Secure subscription_payments RLS to prevent tenant payment deletion
-- Date: 2026-10-07
-- Description:
--   Replaces permissive `FOR ALL` policy on subscription_payments with:
--   1. SELECT policy: Tenants can view payments for their own shops; admins view all.
--   2. INSERT, UPDATE, DELETE policies: Restricted strictly to system administrators (public.is_admin()).
--   Prevents shop owners from deleting or tampering with their payment audit history.
-- ==============================================================================

-- Drop previous permissive policies
DROP POLICY IF EXISTS "Admins manage payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Admins manage subscription_payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Tenants and admins can view subscription payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Admins can insert subscription payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Admins can update subscription payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Admins can delete subscription payments" ON public.subscription_payments;

-- Ensure RLS is enabled on subscription_payments
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- 1. SELECT policy: Tenants view their own payments, admins view all
CREATE POLICY "Tenants and admins can view subscription payments"
ON public.subscription_payments FOR SELECT
TO authenticated
USING (
    public.is_admin() OR
    EXISTS (
        SELECT 1 FROM public.shops 
        WHERE public.shops.id = subscription_payments.shop_id 
        AND public.shops.user_id = auth.uid()
    )
);

-- 2. INSERT policy: Only administrators can create payment audit records
CREATE POLICY "Admins can insert subscription payments"
ON public.subscription_payments FOR INSERT
TO authenticated
WITH CHECK (
    public.is_admin()
);

-- 3. UPDATE policy: Only administrators can update payment audit records
CREATE POLICY "Admins can update subscription payments"
ON public.subscription_payments FOR UPDATE
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

-- 4. DELETE policy: Only administrators can delete payment audit records (prevents tenants from deleting payment history)
CREATE POLICY "Admins can delete subscription payments"
ON public.subscription_payments FOR DELETE
TO authenticated
USING (
    public.is_admin()
);
