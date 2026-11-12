-- Protection supplémentaire, active uniquement sur une base Supabase (rôles publics « anon » /
-- « authenticated » exposés par l'API REST de Supabase). Sur Netlify Database ou un PostgreSQL
-- classique, la base n'est pas exposée publiquement : cette migration ne fait rien.
DO $$
DECLARE r record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
      EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
    END IF;
  END IF;
END $$;
