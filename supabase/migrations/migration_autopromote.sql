-- Trigger: Update Reseller Tenant Count and Auto-Promote
CREATE OR REPLACE FUNCTION public.handle_new_tenant_promotion()
RETURNS TRIGGER AS $$
DECLARE
    v_new_count INT;
    v_current_tier reseller_tier;
BEGIN
    -- Only proceed if tenant has a reseller
    IF NEW.reseller_id IS NOT NULL THEN
        
        -- 1. Increment Tenant Count
        UPDATE public.resellers
        SET tenant_count = (SELECT count(*) FROM public.tenants WHERE reseller_id = NEW.reseller_id AND is_active = true)
        WHERE id = NEW.reseller_id
        RETURNING tenant_count, tier INTO v_new_count, v_current_tier;
        
        -- 2. Check for Promotion (Bronze -> Silver at 10 active tenants)
        IF v_new_count >= 10 AND v_current_tier = 'bronze' THEN
            UPDATE public.resellers
            SET tier = 'silver'
            WHERE id = NEW.reseller_id;
            
            -- Optional: Log promotion event to ledger as a 'note' or specific event?
            -- For now, we keep it silent or could send a notification later.
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind Trigger
DROP TRIGGER IF EXISTS trg_auto_promote_reseller ON public.tenants;
CREATE TRIGGER trg_auto_promote_reseller
AFTER INSERT OR UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_tenant_promotion();
