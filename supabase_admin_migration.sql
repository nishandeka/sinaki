-- ========================================================
-- SINAKI ADMIN PORTAL DATABASE MIGRATION
-- ========================================================

-- 1. Create Admins Table
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'verification_admin', 'moderation_admin', 'support_admin', 'analyst')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT TRUE
);

-- 2. Create Security Functions to bypass Policy Recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE id = user_id AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins WHERE id = user_id AND role = 'super_admin' AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on Admins
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins are readable by authenticated users" ON public.admins;
CREATE POLICY "Admins are readable by authenticated users"
  ON public.admins FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Super admins can modify admins" ON public.admins;
CREATE POLICY "Super admins can modify admins"
  ON public.admins FOR ALL
  USING (public.is_super_admin(auth.uid()));


-- 3. Create Audit Logs Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  admin_id UUID REFERENCES auth.users(id),
  admin_email TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id UUID,
  target_name TEXT,
  details TEXT,
  ip_address TEXT
);

-- Enable RLS on Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- 4. Create Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on Platform Settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view settings" ON public.platform_settings;
CREATE POLICY "Admins can view settings"
  ON public.platform_settings FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can modify settings" ON public.platform_settings;
CREATE POLICY "Super admins can modify settings"
  ON public.platform_settings FOR ALL
  USING (public.is_super_admin(auth.uid()));


-- 5. Seed Default Platform Settings
INSERT INTO public.platform_settings (key, value) VALUES
('matching', '{"min_age": 18, "discovery_radius": "all", "max_likes_free": 20, "max_super_likes_free": 3, "inactivity_days": 90}'::jsonb),
('verification', '{"require_selfie": true, "auto_remind_days": 3, "auto_delete_docs_days": 90, "accepted_types": ["aadhaar", "voter_id", "pan_card", "driving_license", "passport"]}'::jsonb),
('notifications', '{"send_match": true, "send_message": true, "send_weekly_digest": true, "pending_verification_threshold": 50, "unreviewed_reports_threshold": 10}'::jsonb),
('moderation', '{"keyword_blocklist": ["scam", "money", "paytm", "gpay", "whatsapp", "sugar", "hookup"], "auto_flag_phones": true, "auto_flag_urls": true}'::jsonb),
('maintenance', '{"enabled": false, "message": "Sinaki Admin Portal is undergoing scheduled maintenance. Please check back later.", "estimated_downtime": "30 minutes"}'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- 6. Seed Existing Test Users as Admins
-- We do this conditional on their existence in auth.users
INSERT INTO public.admins (id, email, role, is_active)
SELECT id, email, 'super_admin', TRUE FROM auth.users WHERE email = 'test@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

INSERT INTO public.admins (id, email, role, is_active)
SELECT id, email, 'super_admin', TRUE FROM auth.users WHERE email = 'nishandeka31@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

INSERT INTO public.admins (id, email, role, is_active)
SELECT id, email, 'verification_admin', TRUE FROM auth.users WHERE email = 'aasishverma1507@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'verification_admin';

INSERT INTO public.admins (id, email, role, is_active)
SELECT id, email, 'moderation_admin', TRUE FROM auth.users WHERE email = 'dkadulal131@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'moderation_admin';

INSERT INTO public.admins (id, email, role, is_active)
SELECT id, email, 'support_admin', TRUE FROM auth.users WHERE email = 'aasishverma2807@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'support_admin';

INSERT INTO public.admins (id, email, role, is_active)
SELECT id, email, 'analyst', TRUE FROM auth.users WHERE email = 'aashishverma28@flash.co'
ON CONFLICT (id) DO UPDATE SET role = 'analyst';
