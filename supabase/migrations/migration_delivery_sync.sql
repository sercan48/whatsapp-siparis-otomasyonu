-- =====================================================
-- MIGRATION: Delivery Status Synchronization
-- Automatically updates external_platform_orders and pos_orders
-- based on deliveries table status changes.
-- =====================================================
CREATE OR REPLACE FUNCTION sync_delivery_to_order() RETURNS TRIGGER AS $$ BEGIN -- 1. Sync to external_platform_orders if source is 'external'
    -- (source can also be specific platform names like 'yemeksepeti', etc.)
    -- We'll check if the order_id exists in external_platform_orders first
    IF NEW.status = 'picked_up'
    AND OLD.status != 'picked_up' THEN -- Update to 'delivering'
UPDATE external_platform_orders
SET status = 'delivering',
    picked_up_at = NOW()
WHERE id = NEW.order_id;
-- Also try pos_orders/sessions if link exists
-- In pos_order_items, status is per item, which is a bit complex.
-- But AssignCourierModal updates pos_order_items.
UPDATE pos_order_items
SET status = 'delivering'
WHERE pos_order_id = NEW.order_id;
END IF;
IF NEW.status = 'delivered'
AND OLD.status != 'delivered' THEN -- Update to 'delivered'
UPDATE external_platform_orders
SET status = 'delivered',
    delivered_at = NOW()
WHERE id = NEW.order_id;
UPDATE pos_order_items
SET status = 'delivered'
WHERE pos_order_id = NEW.order_id;
-- Also update pos_orders container status
UPDATE pos_orders
SET status = 'delivered'
WHERE id = NEW.order_id;
END IF;
IF NEW.status = 'cancelled'
AND OLD.status != 'cancelled' THEN
UPDATE external_platform_orders
SET status = 'cancelled',
    cancelled_at = NOW()
WHERE id = NEW.order_id;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Create Trigger
DROP TRIGGER IF EXISTS trigger_sync_delivery_to_order ON deliveries;
CREATE TRIGGER trigger_sync_delivery_to_order
AFTER
UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION sync_delivery_to_order();
-- Grant permissions (if needed for the owner of the trigger)
-- Trigger runs with SECURITY DEFINER so it has full power.
COMMENT ON FUNCTION sync_delivery_to_order IS 'Synchronizes delivery status back to the original order table';