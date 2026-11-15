-- ==============================================================================
-- MAVIC Projetos — Configuração de Segurança, RLS e Supabase Storage
-- Execute este script no SQL Editor do seu painel Supabase:
-- https://supabase.com/dashboard/project/ygwrpwkkriaeqaeuuxan/sql/new
-- ==============================================================================

-- 1. Garante que a tabela mavic_store existe
CREATE TABLE IF NOT EXISTS public.mavic_store (
    key text PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- 2. Habilita o Row Level Security (RLS) na tabela mavic_store
ALTER TABLE public.mavic_store ENABLE ROW LEVEL SECURITY;

-- 3. Remove políticas antigas caso existam
DROP POLICY IF EXISTS "Permitir leitura anonima" ON public.mavic_store;
DROP POLICY IF EXISTS "Permitir escrita anonima" ON public.mavic_store;
DROP POLICY IF EXISTS "Admin acesso total" ON public.mavic_store;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.mavic_store;
DROP POLICY IF EXISTS "Permitir acesso total publico" ON public.mavic_store;
DROP POLICY IF EXISTS "Permitir tudo no mavic_store" ON public.mavic_store;
DROP POLICY IF EXISTS "allow_all" ON public.mavic_store;

-- 4. Política de acesso: SOMENTE usuários logados no Supabase Auth (painel administrativo).
--    O Portal do Cliente NÃO acessa esta tabela: ele passa pela Edge Function `cliente-data`,
--    que usa a service role no servidor (a service role ignora RLS).
--    A chave anon (pública, visível no config.js) não consegue mais ler nem gravar nada.
CREATE POLICY "Admin autenticado acesso total"
ON public.mavic_store
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Habilita publicação em Realtime para atualizações automáticas entre abas e dispositivos
-- (idempotente: não dá erro se a tabela já estiver na publicação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mavic_store'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mavic_store;
  END IF;
END $$;


-- ==============================================================================
-- 6. CONFIGURAÇÃO DO SUPABASE STORAGE (Bucket 'mavic_files')
-- Permite armazenar capas de projetos, renders de revisão e pranchas PDF na nuvem.
-- ==============================================================================

-- Garante a criação do bucket público 'mavic_files' com limite de 100MB
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('mavic_files', 'mavic_files', true, 104857600)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

-- Remove TODAS as políticas antigas ou conflitantes (inclusive as públicas) do Storage para o bucket mavic_files
DROP POLICY IF EXISTS "Storage Leitura Publica" ON storage.objects;
DROP POLICY IF EXISTS "Storage Upload Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Storage Update Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Storage Delete Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload mavic_files" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update mavic_files" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delete mavic_files" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura mavic_files" ON storage.objects;
DROP POLICY IF EXISTS "Acesso total mavic_files" ON storage.objects;
DROP POLICY IF EXISTS "mavic_files_public_select" ON storage.objects;
DROP POLICY IF EXISTS "mavic_files_public_insert" ON storage.objects;
DROP POLICY IF EXISTS "mavic_files_public_update" ON storage.objects;
DROP POLICY IF EXISTS "mavic_files_public_delete" ON storage.objects;
DROP POLICY IF EXISTS "allow_all_images" ON storage.objects;

-- Políticas do bucket mavic_files:
-- * O bucket continua PÚBLICO: links de imagens/PDFs (getPublicUrl) seguem abrindo para o cliente.
--   URLs públicas não passam por estas políticas.
-- * Listar, enviar, substituir e apagar arquivos: somente usuários autenticados (painel admin).
DROP POLICY IF EXISTS "mavic_files_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "mavic_files_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "mavic_files_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "mavic_files_auth_delete" ON storage.objects;

CREATE POLICY "mavic_files_auth_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mavic_files');

CREATE POLICY "mavic_files_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mavic_files');

CREATE POLICY "mavic_files_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'mavic_files')
WITH CHECK (bucket_id = 'mavic_files');

CREATE POLICY "mavic_files_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'mavic_files');

-- ==============================================================================
-- 7. Desativar cadastro público no Supabase Auth (fazer no painel, não é SQL):
--    Authentication → Sign In / Providers → desmarque "Allow new users to sign up".
--    Sem isso, qualquer pessoa poderia criar uma conta e virar "authenticated".
-- ==============================================================================
