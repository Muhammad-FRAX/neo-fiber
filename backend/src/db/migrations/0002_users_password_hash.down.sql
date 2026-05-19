-- 0002_users_password_hash.down.sql
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
