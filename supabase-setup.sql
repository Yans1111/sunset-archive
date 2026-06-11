-- ========== 数据库建表 SQL ==========
-- 在 Supabase SQL Editor 中执行

-- 1. 用户资料表
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 照片表
CREATE TABLE photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  avg_rating NUMERIC(3,1) DEFAULT 0,
  vote_count INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 评分表
CREATE TABLE ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, user_id)
);

-- 4. 投票表
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT CHECK (vote_type IN ('up', 'down')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, user_id)
);

-- ========== Row Level Security (RLS) ==========

-- profiles: 所有人可读，仅自己可写
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- photos: 所有人可读，仅自己可写
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "photos_select" ON photos FOR SELECT USING (true);
CREATE POLICY "photos_insert" ON photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "photos_update" ON photos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "photos_delete" ON photos FOR DELETE USING (auth.uid() = user_id);

-- ratings: 所有人可读，仅自己可写
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_select" ON ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert" ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings_update" ON ratings FOR UPDATE USING (auth.uid() = user_id);

-- votes: 所有人可读，仅自己可写
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "votes_update" ON votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "votes_delete" ON votes FOR DELETE USING (auth.uid() = user_id);

-- ========== Storage Bucket ==========
-- 在 Supabase Dashboard → Storage 中手动创建名为 "sunset-photos" 的 bucket
-- 并设置该 bucket 为 public
-- 或者执行以下 SQL：

INSERT INTO storage.buckets (id, name, public)
VALUES ('sunset-photos', 'sunset-photos', true)
ON CONFLICT DO NOTHING;

-- Storage RLS: 已登录用户可上传，所有人可读
CREATE POLICY "storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'sunset-photos');

CREATE POLICY "storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'sunset-photos' AND auth.role() = 'authenticated');

CREATE POLICY "storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'sunset-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
