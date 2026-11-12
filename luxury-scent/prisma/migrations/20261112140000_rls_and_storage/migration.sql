-- Sécurité Supabase : active la Row Level Security sur toutes les tables de l'application.
-- Aucune politique n'est créée : les clés publiques Supabase (anon / authenticated) n'ont donc
-- AUCUN accès aux données via l'API REST. Seul le serveur de la boutique (connexion Postgres
-- directe, rôle propriétaire) lit et écrit, après ses propres contrôles d'autorisation.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- Retire en plus les droits par défaut des rôles publics de Supabase (s'ils existent).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
  END IF;
END $$;

-- Buckets de stockage (Supabase uniquement) : « media » public en lecture, « private » sans accès public.
-- Les envois passent par des URL signées délivrées par le serveur ; aucune politique d'écriture publique.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('media', 'media', true, 52428800, ARRAY['image/webp','image/jpeg','image/png','image/avif','image/gif','video/mp4','video/webm'])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('private', 'private', false, 10485760, ARRAY['application/pdf','image/webp','image/jpeg','image/png'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
