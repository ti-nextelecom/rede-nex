CREATE TABLE IF NOT EXISTS user_appearance_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'dark' CHECK (mode IN ('light','dark','system')),
  accent_color text NOT NULL DEFAULT '#ff7a00' CHECK (accent_color ~ '^#[0-9a-f]{6}$'),
  surface_color text NOT NULL DEFAULT '#182536' CHECK (surface_color ~ '^#[0-9a-f]{6}$'),
  chat_background text CHECK (chat_background ~ '^#[0-9a-f]{6}$'),
  chat_incoming text CHECK (chat_incoming ~ '^#[0-9a-f]{6}$'),
  chat_outgoing text CHECK (chat_outgoing ~ '^#[0-9a-f]{6}$'),
  -- Backgrounds from the former chat settings remain compatible.
  wallpaper text NOT NULL DEFAULT '' CHECK (octet_length(wallpaper) <= 7100000),
  platform_wallpaper text NOT NULL DEFAULT '' CHECK (octet_length(platform_wallpaper) <= 7100000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON user_appearance_preferences FROM PUBLIC;
