-- ============================================
-- 🍹 DRINKOMETRO — Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profili utente (estende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_days INTEGER DEFAULT 0,
  total_drinks INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  preferred_currency TEXT DEFAULT 'EUR',
  preferred_lang TEXT DEFAULT 'it',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drink registrati
CREATE TABLE IF NOT EXISTS drinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  drink_type TEXT NOT NULL,
  drink_name TEXT,
  quantity DECIMAL(5,2) NOT NULL,
  quantity_unit TEXT DEFAULT 'ml',
  cost DECIMAL(8,2),
  currency TEXT DEFAULT 'EUR',
  location TEXT,
  location_lat DECIMAL(10,7),
  location_lng DECIMAL(10,7),
  mood TEXT,
  mood_emoji TEXT,
  media_url TEXT,
  media_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Storie (durano 24 ore)
CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  drink_id UUID REFERENCES drinks(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL,
  caption TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

CREATE TABLE IF NOT EXISTS story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Amicizie
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Reazioni e commenti ai drink
CREATE TABLE IF NOT EXISTS drink_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(drink_id, user_id)
);

CREATE TABLE IF NOT EXISTS drink_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drink_id UUID REFERENCES drinks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Club
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, user_id)
);

-- Sfide del club
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL,
  target_value INTEGER,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  UNIQUE(challenge_id, user_id)
);

-- Gamification: Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  icon TEXT,
  criteria_type TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  xp_reward INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE drink_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can update
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Drinks: owner can CRUD, friends can read
CREATE POLICY "Users can CRUD own drinks" ON drinks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Friends can view drinks" ON drinks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id = drinks.user_id)
      OR (addressee_id = auth.uid() AND requester_id = drinks.user_id)
    )
  )
);

-- Stories: owner can CRUD, friends can read (only non-expired)
CREATE POLICY "Users can CRUD own stories" ON stories FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Friends can view active stories" ON stories FOR SELECT USING (
  expires_at > NOW()
  AND EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = auth.uid() AND addressee_id = stories.user_id)
      OR (addressee_id = auth.uid() AND requester_id = stories.user_id)
    )
  )
);

-- Story views & reactions: authenticated users
CREATE POLICY "Auth users can manage story views" ON story_views FOR ALL USING (auth.uid() = viewer_id);
CREATE POLICY "Auth users can read story views" ON story_views FOR SELECT USING (true);
CREATE POLICY "Auth users can manage story reactions" ON story_reactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Auth users can read story reactions" ON story_reactions FOR SELECT USING (true);

-- Friendships: involved users can manage
CREATE POLICY "Users can view own friendships" ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can send friend requests" ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update own friendships" ON friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can delete own friendships" ON friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Drink reactions & comments: authenticated users
CREATE POLICY "Auth users can manage drink reactions" ON drink_reactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read drink reactions" ON drink_reactions FOR SELECT USING (true);
CREATE POLICY "Auth users can manage drink comments" ON drink_comments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can read drink comments" ON drink_comments FOR SELECT USING (true);

-- Clubs: members can view, creator is admin
CREATE POLICY "Anyone can view clubs" ON clubs FOR SELECT USING (true);
CREATE POLICY "Auth users can create clubs" ON clubs FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update clubs" ON clubs FOR UPDATE USING (auth.uid() = created_by);

-- Club members: viewable by all, manageable by admins
CREATE POLICY "Anyone can view club members" ON club_members FOR SELECT USING (true);
CREATE POLICY "Auth users can join clubs" ON club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave clubs" ON club_members FOR DELETE USING (auth.uid() = user_id);

-- Challenges: viewable by club members
CREATE POLICY "Club members can view challenges" ON challenges FOR SELECT USING (true);
CREATE POLICY "Auth users can create challenges" ON challenges FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Challenge participants
CREATE POLICY "Anyone can view participants" ON challenge_participants FOR SELECT USING (true);
CREATE POLICY "Users can join challenges" ON challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON challenge_participants FOR UPDATE USING (auth.uid() = user_id);

-- Achievements
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (true);
CREATE POLICY "Anyone can view user achievements" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "Users can earn achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Trigger: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Trigger: Update profile stats on drink insert
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_drink()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET
    total_drinks = total_drinks + 1,
    total_spent = total_spent + COALESCE(NEW.cost, 0),
    xp = xp + 10,
    updated_at = NOW()
  WHERE id = NEW.user_id;
  
  -- Check level up
  UPDATE profiles SET level = 
    CASE 
      WHEN xp >= 2000 THEN 6
      WHEN xp >= 1000 THEN 5
      WHEN xp >= 600 THEN 4
      WHEN xp >= 300 THEN 3
      WHEN xp >= 100 THEN 2
      ELSE 1
    END
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_drink_created ON drinks;
CREATE TRIGGER on_drink_created
  AFTER INSERT ON drinks
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_drink();

-- ============================================
-- Seed Achievements
-- ============================================
INSERT INTO achievements (name, name_en, description, description_en, icon, criteria_type, threshold, xp_reward) VALUES
  ('Prima Bevuta', 'First Drink', 'Registra il tuo primo drink', 'Log your first drink', '🍺', 'total_drinks', 1, 10),
  ('Selfie Star', 'Selfie Star', 'Pubblica 10 storie', 'Post 10 stories', '📸', 'stories_posted', 10, 50),
  ('Globe Trotter', 'Globe Trotter', 'Bevi in 5 luoghi diversi', 'Drink in 5 different places', '🌍', 'unique_locations', 5, 50),
  ('In Fiamme', 'On Fire', 'Streak di 7 giorni', '7-day streak', '🔥', 'streak_days', 7, 100),
  ('Campione', 'Champion', 'Vinci una sfida del club', 'Win a club challenge', '🎯', 'challenges_won', 1, 50),
  ('Mixologist', 'Mixologist', 'Prova 10 cocktail diversi', 'Try 10 different cocktails', '🍸', 'unique_cocktails', 10, 50),
  ('Risparmiatore', 'Saver', 'Spendi meno di 10€ in una serata', 'Spend less than €10 in a night', '💸', 'cheap_night', 1, 30),
  ('Social Butterfly', 'Social Butterfly', 'Aggiungi 10 amici', 'Add 10 friends', '🤝', 'friends_count', 10, 50),
  ('Fondatore', 'Founder', 'Crea il tuo primo club', 'Create your first club', '🏛', 'clubs_created', 1, 30),
  ('Decano', 'Veteran', 'Registra 10 drink', 'Log 10 drinks', '🔟', 'total_drinks', 10, 30),
  ('Centurione', 'Centurion', 'Registra 50 drink', 'Log 50 drinks', '💯', 'total_drinks', 50, 100),
  ('Party Animal', 'Party Animal', '5 drink in una sola serata', '5 drinks in a single night', '🎉', 'drinks_single_night', 5, 30)
ON CONFLICT DO NOTHING;

-- ============================================
-- Storage Bucket for media
-- ============================================
-- Run in Supabase Dashboard > Storage:
-- Create bucket "media" with public access
-- Set file size limit to 5MB
-- Allowed MIME types: image/*, video/*
