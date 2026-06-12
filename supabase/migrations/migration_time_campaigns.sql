-- =====================================================
-- Time-Based Campaigns Migration
-- Add time-specific and day-specific campaign scheduling
-- =====================================================

-- Add time-based fields to campaigns table
DO $$
BEGIN
    -- Start time for campaign
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'start_time') THEN
        ALTER TABLE campaigns ADD COLUMN start_time TIME;
    END IF;

    -- End time for campaign
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'end_time') THEN
        ALTER TABLE campaigns ADD COLUMN end_time TIME;
    END IF;

    -- Active days (0=Sunday, 1=Monday, ..., 6=Saturday)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'active_days') THEN
        ALTER TABLE campaigns ADD COLUMN active_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}';
    END IF;

    -- Time zone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'timezone') THEN
        ALTER TABLE campaigns ADD COLUMN timezone VARCHAR(50) DEFAULT 'Europe/Istanbul';
    END IF;

    -- Campaign type (always, scheduled, time_based)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'schedule_type') THEN
        ALTER TABLE campaigns ADD COLUMN schedule_type VARCHAR(20) DEFAULT 'always';
    END IF;

    -- Recurring (daily, weekly, once)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'recurrence') THEN
        ALTER TABLE campaigns ADD COLUMN recurrence VARCHAR(20) DEFAULT 'daily';
    END IF;
END $$;

-- Function to check if a campaign is currently active
CREATE OR REPLACE FUNCTION is_campaign_active(campaign_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    camp RECORD;
    current_time_val TIME;
    current_day INTEGER;
BEGIN
    SELECT * INTO camp FROM campaigns WHERE id = campaign_id;
    
    IF camp IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if campaign is enabled
    IF NOT camp.is_active THEN
        RETURN FALSE;
    END IF;
    
    -- Check date range
    IF camp.start_date IS NOT NULL AND CURRENT_DATE < camp.start_date THEN
        RETURN FALSE;
    END IF;
    
    IF camp.end_date IS NOT NULL AND CURRENT_DATE > camp.end_date THEN
        RETURN FALSE;
    END IF;
    
    -- If always active, return true
    IF camp.schedule_type = 'always' OR camp.schedule_type IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check time-based scheduling
    IF camp.schedule_type = 'time_based' THEN
        current_time_val := CURRENT_TIME;
        current_day := EXTRACT(DOW FROM CURRENT_TIMESTAMP)::INTEGER;
        
        -- Check active days
        IF camp.active_days IS NOT NULL AND NOT (current_day = ANY(camp.active_days)) THEN
            RETURN FALSE;
        END IF;
        
        -- Check time range
        IF camp.start_time IS NOT NULL AND camp.end_time IS NOT NULL THEN
            IF camp.start_time <= camp.end_time THEN
                -- Normal time range (e.g., 10:00 - 14:00)
                IF current_time_val < camp.start_time OR current_time_val > camp.end_time THEN
                    RETURN FALSE;
                END IF;
            ELSE
                -- Overnight time range (e.g., 22:00 - 02:00)
                IF current_time_val < camp.start_time AND current_time_val > camp.end_time THEN
                    RETURN FALSE;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- View for currently active campaigns
CREATE OR REPLACE VIEW active_campaigns AS
SELECT * FROM campaigns
WHERE is_campaign_active(id) = TRUE;

-- Sample time-based campaigns data
-- INSERT INTO campaigns (tenant_id, name, campaign_type, discount_value, schedule_type, start_time, end_time, active_days)
-- VALUES 
--     ('tenant-id', 'Öğle Menüsü İndirimi', 'percentage', 15, 'time_based', '11:00', '14:00', '{1,2,3,4,5}'),
--     ('tenant-id', 'Happy Hour', 'percentage', 20, 'time_based', '17:00', '19:00', '{1,2,3,4,5}'),
--     ('tenant-id', 'Hafta Sonu Özel', 'percentage', 10, 'time_based', '10:00', '22:00', '{0,6}');
