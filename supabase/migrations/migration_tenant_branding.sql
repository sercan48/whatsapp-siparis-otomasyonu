-- Migration: Tenant Branding System
-- Adds branding and menu settings to profiles table
-- Branding settings (logo, colors, font)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{
  "logo_url": null,
  "primary_color": "#FF6B00",
  "secondary_color": "#1F2937",
  "accent_color": "#10B981",
  "background_type": "light",
  "font_family": "Inter"
}'::jsonb;
-- Menu display settings
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS menu_settings JSONB DEFAULT '{
  "show_prices": true,
  "show_descriptions": true,
  "show_images": true,
  "currency_symbol": "₺",
  "layout": "grid",
  "enable_notes": true,
  "enable_customization": true
}'::jsonb;
-- WhatsApp settings
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS whatsapp_phone_id TEXT;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS default_table_id UUID REFERENCES tables(id);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_branding ON profiles USING GIN (branding);
COMMENT ON COLUMN profiles.branding IS 'Tenant branding settings: logo, colors, font';
COMMENT ON COLUMN profiles.menu_settings IS 'Menu display preferences';