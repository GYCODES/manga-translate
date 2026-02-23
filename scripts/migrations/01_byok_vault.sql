-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Link UID to Secret UUID
CREATE TABLE IF NOT EXISTS public.user_keys_map (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    key_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_keys_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can only access their own key mapping" ON public.user_keys_map
        FOR ALL USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Upsert function
CREATE OR REPLACE FUNCTION public.upsert_user_api_key(api_key_text TEXT)
RETURNS VOID AS $$
DECLARE
    v_key_id UUID;
BEGIN
    -- Check if user already has a key
    SELECT key_id INTO v_key_id FROM public.user_keys_map WHERE user_id = auth.uid();
    
    IF v_key_id IS NOT NULL THEN
        -- Update existing secret in vault
        PERFORM vault.update_secret(v_key_id, api_key_text);
    ELSE
        -- Create new secret in vault
        v_key_id := vault.create_secret(api_key_text, 'gemini_api_key', 'User provided Gemini API Key');
        INSERT INTO public.user_keys_map (user_id, key_id) VALUES (auth.uid(), v_key_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get decrypted function
CREATE OR REPLACE FUNCTION public.get_decrypted_user_key()
RETURNS TEXT AS $$
DECLARE
    v_text TEXT;
BEGIN
    SELECT decrypted_secret INTO v_text
    FROM vault.decrypted_secrets ds
    JOIN public.user_keys_map ukm ON ds.id = ukm.key_id
    WHERE ukm.user_id = auth.uid();
    
    RETURN v_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
