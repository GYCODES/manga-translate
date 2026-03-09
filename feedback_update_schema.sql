-- Run this SQL in your Supabase SQL Editor to update the feedback table

ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'completed'));
