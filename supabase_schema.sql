-- Drop old BSSRV tables if they exist
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.matches CASCADE;
DROP TABLE IF EXISTS public.likes CASCADE;
DROP TABLE IF EXISTS public.blocked_users CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =============================================
-- SINAKI DATABASE SCHEMA (Supabase / PostgreSQL)
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUM TYPES
-- =============================================

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('male', 'female');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'under_review', 'verified', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE report_reason AS ENUM (
    'fake_profile', 'inappropriate_content', 'harassment',
    'underage_suspicion', 'spam', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE religion_type AS ENUM (
    'hindu', 'muslim', 'christian', 'buddhist',
    'sikh', 'jain', 'tribal_religion', 'other', 'prefer_not_to_say'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE community_type AS ENUM (
    'assamese', 'bodo', 'mising', 'karbi', 'dimasa',
    'rabha', 'tiwa', 'deori', 'sonowal_kachari', 'tai_ahom',
    'koch_rajbongshi', 'bengali', 'nepali', 'tea_tribe',
    'marwari', 'bihari', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE education_type AS ENUM (
    'high_school', 'higher_secondary', 'diploma',
    'bachelors', 'masters', 'phd', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE body_type AS ENUM (
    'slim', 'average', 'athletic', 'curvy', 'plus_size', 'prefer_not_to_say'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 1. PROFILES TABLE (extends Supabase auth.users)
-- =============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic Info
  full_name TEXT NOT NULL CHECK (char_length(full_name) >= 2),
  display_name TEXT NOT NULL CHECK (char_length(display_name) >= 2),
  gender gender_type NOT NULL,
  date_of_birth DATE NOT NULL,
  phone TEXT UNIQUE,
  
  -- Location (Assam-centric)
  district TEXT NOT NULL,
  city_town TEXT,
  pin_code TEXT CHECK (char_length(pin_code) = 6),
  
  -- Cultural Identity
  community community_type DEFAULT 'assamese',
  religion religion_type DEFAULT 'prefer_not_to_say',
  mother_tongue TEXT DEFAULT 'Assamese',
  speaks_languages TEXT[] DEFAULT ARRAY['Assamese', 'Hindi', 'English'],
  
  -- Personal Details
  bio TEXT CHECK (char_length(bio) <= 500),
  height_cm INTEGER CHECK (height_cm BETWEEN 120 AND 250),
  body_type body_type DEFAULT 'prefer_not_to_say',
  education education_type,
  occupation TEXT,
  workplace TEXT,
  
  -- Lifestyle
  smoking BOOLEAN DEFAULT FALSE,
  drinking BOOLEAN DEFAULT FALSE,
  diet TEXT CHECK (diet IN ('vegetarian', 'non_vegetarian', 'eggetarian', 'vegan')),
  looking_for TEXT,
  
  -- Photos (Supabase Storage URLs)
  avatar_url TEXT,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Verification
  verification_status verification_status DEFAULT 'pending',
  id_card_url TEXT,
  id_card_type TEXT CHECK (id_card_type IN ('aadhaar', 'voter_id', 'pan_card', 'driving_license', 'passport')),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Preferences / Matching
  interested_in gender_type NOT NULL,
  preferred_age_min INTEGER DEFAULT 18 CHECK (preferred_age_min >= 18),
  preferred_age_max INTEGER DEFAULT 50 CHECK (preferred_age_max <= 70),
  preferred_districts TEXT[],
  preferred_communities community_type[],
  preferred_religion religion_type[],
  preferred_education education_type[],
  
  -- App Meta
  is_active BOOLEAN DEFAULT TRUE,
  is_profile_complete BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  profile_completion_pct INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT age_must_be_18_plus CHECK (
    DATE_PART('year', AGE(date_of_birth)) >= 18
  ),
  CONSTRAINT opposite_gender_interest CHECK (
    (gender = 'male' AND interested_in = 'female') OR
    (gender = 'female' AND interested_in = 'male')
  ),
  CONSTRAINT max_6_photos CHECK (array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 6)
);

CREATE INDEX idx_profiles_gender ON public.profiles(gender);
CREATE INDEX idx_profiles_district ON public.profiles(district);
CREATE INDEX idx_profiles_verification ON public.profiles(verification_status);
CREATE INDEX idx_profiles_active ON public.profiles(is_active);
CREATE INDEX idx_profiles_community ON public.profiles(community);
CREATE INDEX idx_profiles_last_seen ON public.profiles(last_seen DESC);

-- =============================================
-- 2. LIKES / SWIPES TABLE
-- =============================================

CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  liker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  liked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_super_like BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT no_self_like CHECK (liker_id != liked_id),
  CONSTRAINT unique_like UNIQUE (liker_id, liked_id)
);

CREATE INDEX idx_likes_liker ON public.likes(liker_id);
CREATE INDEX idx_likes_liked ON public.likes(liked_id);

-- =============================================
-- 3. PASSES / SKIPS TABLE
-- =============================================

CREATE TABLE public.passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  passed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT no_self_pass CHECK (passer_id != passed_id),
  CONSTRAINT unique_pass UNIQUE (passer_id, passed_id)
);

-- =============================================
-- 4. MATCHES TABLE (mutual likes)
-- =============================================

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status match_status DEFAULT 'accepted',
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  unmatched_at TIMESTAMPTZ,
  unmatched_by UUID REFERENCES public.profiles(id),
  compatibility_score REAL,
  
  CONSTRAINT no_self_match CHECK (user_1_id != user_2_id),
  CONSTRAINT ordered_users CHECK (user_1_id < user_2_id),
  CONSTRAINT unique_match UNIQUE (user_1_id, user_2_id)
);

CREATE INDEX idx_matches_user1 ON public.matches(user_1_id);
CREATE INDEX idx_matches_user2 ON public.matches(user_2_id);

-- =============================================
-- 5. CONVERSATIONS TABLE
-- =============================================

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_by UUID REFERENCES public.profiles(id),
  user_1_unread_count INTEGER DEFAULT 0,
  user_2_unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_conversation UNIQUE (match_id)
);

-- =============================================
-- 6. MESSAGES TABLE
-- =============================================

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'gif', 'emoji')),
  media_url TEXT,
  status message_status DEFAULT 'sent',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

-- =============================================
-- 7. REPORTS TABLE
-- =============================================

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  description TEXT,
  evidence_urls TEXT[],
  is_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by TEXT,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- =============================================
-- 8. BLOCKS TABLE
-- =============================================

CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

-- =============================================
-- 9. VERIFICATION QUEUE TABLE
-- =============================================

CREATE TABLE public.verification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  id_card_url TEXT NOT NULL,
  id_card_type TEXT NOT NULL,
  selfie_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  status verification_status DEFAULT 'pending',
  notes TEXT
);

CREATE INDEX idx_verification_pending ON public.verification_queue(status) WHERE status = 'pending';

-- =============================================
-- 10. NOTIFICATIONS TABLE
-- =============================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'new_match', 'new_message', 'new_like', 'super_like',
    'verification_approved', 'verification_rejected',
    'profile_reminder', 'system'
  )),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

-- =============================================
-- 11. ASSAM DISTRICTS REFERENCE TABLE
-- =============================================

CREATE TABLE public.assam_districts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  division TEXT,
  headquarters TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO public.assam_districts (name, division, headquarters) VALUES
('Baksa', 'Lower Assam', 'Mushalpur'),
('Barpeta', 'Lower Assam', 'Barpeta'),
('Biswanath', 'North Assam', 'Biswanath Chariali'),
('Bongaigaon', 'Lower Assam', 'Bongaigaon'),
('Cachar', 'Barak Valley', 'Silchar'),
('Charaideo', 'Upper Assam', 'Sonari'),
('Chirang', 'Lower Assam', 'Kajalgaon'),
('Darrang', 'North Assam', 'Mangaldoi'),
('Dhemaji', 'North Assam', 'Dhemaji'),
('Dhubri', 'Lower Assam', 'Dhubri'),
('Dibrugarh', 'Upper Assam', 'Dibrugarh'),
('Dima Hasao', 'Central Assam', 'Haflong'),
('Goalpara', 'Lower Assam', 'Goalpara'),
('Golaghat', 'Central Assam', 'Golaghat'),
('Hailakandi', 'Barak Valley', 'Hailakandi'),
('Hojai', 'Central Assam', 'Hojai'),
('Jorhat', 'Upper Assam', 'Jorhat'),
('Kamrup', 'Lower Assam', 'Amingaon'),
('Kamrup Metropolitan', 'Lower Assam', 'Guwahati'),
('Karbi Anglong', 'Central Assam', 'Diphu'),
('Karimganj', 'Barak Valley', 'Karimganj'),
('Kokrajhar', 'Lower Assam', 'Kokrajhar'),
('Lakhimpur', 'North Assam', 'North Lakhimpur'),
('Majuli', 'Upper Assam', 'Garamur'),
('Morigaon', 'Central Assam', 'Morigaon'),
('Nagaon', 'Central Assam', 'Nagaon'),
('Nalbari', 'Lower Assam', 'Nalbari'),
('Sivasagar', 'Upper Assam', 'Sivasagar'),
('Sonitpur', 'North Assam', 'Tezpur'),
('South Salmara-Mankachar', 'Lower Assam', 'Hatsingimari'),
('Tinsukia', 'Upper Assam', 'Tinsukia'),
('Udalguri', 'North Assam', 'Udalguri'),
('West Karbi Anglong', 'Central Assam', 'Hamren'),
('Bajali', 'Lower Assam', 'Pathsala'),
('Tamulpur', 'Lower Assam', 'Tamulpur')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION calculate_compatibility(user_a UUID, user_b UUID)
RETURNS REAL AS $$
DECLARE
  score REAL := 0;
  profile_a public.profiles%ROWTYPE;
  profile_b public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO profile_a FROM public.profiles WHERE id = user_a;
  SELECT * INTO profile_b FROM public.profiles WHERE id = user_b;
  
  IF profile_a.district = profile_b.district THEN
    score := score + 20;
  END IF;
  
  IF profile_a.community = profile_b.community THEN
    score := score + 15;
  END IF;
  
  IF profile_a.religion = profile_b.religion THEN
    score := score + 10;
  END IF;
  
  IF profile_a.education = profile_b.education THEN
    score := score + 10;
  END IF;
  
  IF DATE_PART('year', AGE(profile_b.date_of_birth)) BETWEEN profile_a.preferred_age_min AND profile_a.preferred_age_max THEN
    score := score + 15;
  END IF;
  IF DATE_PART('year', AGE(profile_a.date_of_birth)) BETWEEN profile_b.preferred_age_min AND profile_b.preferred_age_max THEN
    score := score + 15;
  END IF;
  
  score := score + LEAST(15, 5 * (
    SELECT COUNT(*) FROM unnest(profile_a.speaks_languages) a
    JOIN unnest(profile_b.speaks_languages) b ON a = b
  ));
  
  score := LEAST(100, score);
  
  RETURN score;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_mutual_like()
RETURNS TRIGGER AS $$
DECLARE
  mutual_exists BOOLEAN;
  u1 UUID;
  u2 UUID;
  compat_score REAL;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.likes
    WHERE liker_id = NEW.liked_id AND liked_id = NEW.liker_id
  ) INTO mutual_exists;
  
  IF mutual_exists THEN
    IF NEW.liker_id < NEW.liked_id THEN
      u1 := NEW.liker_id;
      u2 := NEW.liked_id;
    ELSE
      u1 := NEW.liked_id;
      u2 := NEW.liker_id;
    END IF;
    
    SELECT calculate_compatibility(u1, u2) INTO compat_score;
    
    INSERT INTO public.matches (user_1_id, user_2_id, compatibility_score)
    VALUES (u1, u2, compat_score)
    ON CONFLICT (user_1_id, user_2_id) DO NOTHING;
    
    INSERT INTO public.conversations (match_id, user_1_id, user_2_id)
    SELECT m.id, u1, u2
    FROM public.matches m
    WHERE m.user_1_id = u1 AND m.user_2_id = u2
    ON CONFLICT (match_id) DO NOTHING;
    
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES
      (NEW.liker_id, 'new_match', 'Bohut Bhal! 🎉', 'You have a new match! Start a conversation.'),
      (NEW.liked_id, 'new_match', 'Bohut Bhal! 🎉', 'You have a new match! Start a conversation.');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_mutual_like ON public.likes;
CREATE TRIGGER trigger_check_mutual_like
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION check_mutual_like();

-- Auto-confirm all new user signups to bypass verification email links
CREATE OR REPLACE FUNCTION public.auto_confirm_users()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  NEW.confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_confirm_users ON auth.users;
CREATE TRIGGER trigger_auto_confirm_users
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_users();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: viewable by authenticated users, editable by owner
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Likes: users can see their own likes
DROP POLICY IF EXISTS "Users can see own likes" ON public.likes;
CREATE POLICY "Users can see own likes"
  ON public.likes FOR SELECT
  USING (auth.uid() = liker_id OR auth.uid() = liked_id);

DROP POLICY IF EXISTS "Users can insert own likes" ON public.likes;
CREATE POLICY "Users can insert own likes"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = liker_id);

-- Matches: both users can see
DROP POLICY IF EXISTS "Users can see own matches" ON public.matches;
CREATE POLICY "Users can see own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

-- Conversations: participants only
DROP POLICY IF EXISTS "Conversation participants can view" ON public.conversations;
CREATE POLICY "Conversation participants can view"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_1_id OR auth.uid() = user_2_id);

-- Messages: conversation participants only
DROP POLICY IF EXISTS "Message participants can view" ON public.messages;
CREATE POLICY "Message participants can view"
  ON public.messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_1_id = auth.uid() OR user_2_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_1_id = auth.uid() OR user_2_id = auth.uid()
    )
  );

-- Notifications: own only
DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Blocks: own only
DROP POLICY IF EXISTS "Users see own blocks" ON public.blocks;
CREATE POLICY "Users see own blocks"
  ON public.blocks FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block" ON public.blocks;
CREATE POLICY "Users can block"
  ON public.blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Reports: reporters can see their own
DROP POLICY IF EXISTS "Users see own reports" ON public.reports;
CREATE POLICY "Users see own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can submit reports" ON public.reports;
CREATE POLICY "Users can submit reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Districts: public read
ALTER TABLE public.assam_districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Districts are publicly readable" ON public.assam_districts;
CREATE POLICY "Districts are publicly readable"
  ON public.assam_districts FOR SELECT
  USING (TRUE);

-- Verification queue: service role only (handled via Edge Functions)
ALTER TABLE public.verification_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can submit own verification" ON public.verification_queue;
CREATE POLICY "Users can submit own verification"
  ON public.verification_queue FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can view own verification status" ON public.verification_queue;
CREATE POLICY "Users can view own verification status"
  ON public.verification_queue FOR SELECT
  USING (auth.uid() = profile_id);

