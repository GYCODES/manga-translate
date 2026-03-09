-- Run this SQL in your Supabase SQL Editor to create the feedback table

CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT,
    username TEXT,
    category TEXT NOT NULL CHECK (category IN ('bug', 'translation', 'suggestion', 'other')),
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (Optional, but good practice)
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert feedback (since we allow anonymous and authenticated)
CREATE POLICY "Anyone can insert feedback" ON feedback
    FOR INSERT
    WITH CHECK (true);

-- Allow only admins to select/delete feedback
CREATE POLICY "Admins can view feedback" ON feedback
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'admin'
        )
    );

CREATE POLICY "Admins can delete feedback" ON feedback
    FOR DELETE
    USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE role = 'admin'
        )
    );
