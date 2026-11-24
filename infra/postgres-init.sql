-- Runs once, on an empty volume, before any migration.
-- The migration only creates plinth_app as NOLOGIN when it is missing;
-- here it gets a password so the API can connect with it.
create role plinth_app login password 'plinth_app';
