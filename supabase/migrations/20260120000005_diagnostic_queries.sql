-- DIAGNOSTIC QUERIES - Run in Supabase SQL Editor
-- This will help identify the data mismatch issues
-- 1. Check profiles table - find your profile
SELECT id,
    tenant_id,
    slug,
    email,
    branding->>'primary_color' as primary_color,
    branding->>'logo_url' as logo_url
FROM profiles
WHERE slug LIKE 'restoran%'
    OR email = 'sercanacar48@gmail.com';
-- 2. Check menu items and their tenant_id
SELECT id,
    name,
    tenant_id,
    is_active,
    created_at
FROM menu
ORDER BY created_at DESC
LIMIT 20;
-- 3. Check if tenant_id values match between profiles and menu
SELECT p.id as profile_id,
    p.slug,
    p.tenant_id as profile_tenant_id,
    m.id as menu_id,
    m.name as menu_name,
    m.tenant_id as menu_tenant_id,
    CASE
        WHEN p.tenant_id = m.tenant_id THEN 'MATCH'
        ELSE 'MISMATCH'
    END as status
FROM profiles p
    LEFT JOIN menu m ON (
        m.tenant_id = p.tenant_id
        OR m.tenant_id = p.id
    )
WHERE p.slug LIKE 'restoran%'
LIMIT 20;
-- 4. Check tenants table
SELECT id,
    name
FROM tenants
LIMIT 10;
-- 5. FIX: Update menu items to use correct tenant_id
-- UNCOMMENT AND RUN ONLY AFTER CONFIRMING THE IDS:
-- UPDATE menu 
-- SET tenant_id = '5eca8855-9ea0-4d36-b1bf-35c6bf47423a'
-- WHERE tenant_id = '5699ed48-30a2-4f1b-936c-04bd4e392174';
-- 6. FIX: If profile doesn't have branding, update it
-- UPDATE profiles 
-- SET branding = jsonb_build_object(
--     'primary_color', '#FF6B00',
--     'accent_color', '#10B981',
--     'secondary_color', '#1F2937',
--     'background_type', 'light',
--     'font_family', 'Inter'
-- )
-- WHERE id = '5eca8855-9ea0-4d36-b1bf-35c6bf47423a'
-- AND branding IS NULL;