CREATE TABLE guest_save (
    guest_id   VARCHAR(64) PRIMARY KEY,
    data       TEXT        NOT NULL,
    updated_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);
