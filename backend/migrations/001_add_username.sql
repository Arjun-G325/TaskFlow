-- Run this once against the existing TaskFlow MySQL database.
-- Existing users receive a unique placeholder username based on their ID.

ALTER TABLE users
    ADD COLUMN username VARCHAR(50) NULL;

UPDATE users
SET username = CONCAT('user', id)
WHERE username IS NULL;

ALTER TABLE users
    MODIFY COLUMN username VARCHAR(50) NOT NULL;

CREATE UNIQUE INDEX uq_users_username
    ON users (username);
