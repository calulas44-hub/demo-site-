-- Tables publiques sans RLS (doit renvoyer 0 ligne).
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity;
