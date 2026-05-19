-- 0002_users_password_hash.sql
-- Adds password_hash column for AUTH_LOCAL_ONLY mode.
-- bcrypt hashes are 60 chars; 72 gives headroom for future algorithm switch.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(72);
