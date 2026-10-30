-- Preferences are private writes through the authenticated server. XP is unchanged.
CREATE TABLE IF NOT EXISTS user_avatar_frames (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  frame_slug text NOT NULL DEFAULT 'automatic' CHECK (frame_slug IN (
    'automatic','none','nex','ocean','iris',
    'level-1','level-2','level-3','level-4','level-5',
    'level-6','level-7','level-8','level-9','level-10'
  )),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON user_avatar_frames FROM PUBLIC;
