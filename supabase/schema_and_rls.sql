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

-- 4. Cria política de acesso para a aplicação (leitura e escrita)
CREATE POLICY "Permitir acesso total publico"
ON public.mavic_store
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 5. Habilita publicação em Realtime para atualizações automáticas entre abas e dispositivos
ALTER PUBLICATION supabase_realtime ADD TABLE public.mavic_store;


-- ==============================================================================
-- 6. CONFIGURAÇÃO DO SUPABASE STORAGE (Bucket 'mavic_files')
-- Permite armazenar capas de projetos, renders de revisão e pranchas PDF na nuvem.
-- ==============================================================================

-- Garante a criação do bucket público 'mavic_files' com limite de 100MB
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('mavic_files', 'mavic_files', true, 104857600)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

-- Remove TODAS as políticas antigas ou conflitantes do Storage para o bucket mavic_files
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

-- Políticas explícitas para SELECT, INSERT, UPDATE, DELETE no bucket mavic_files
-- Permite upload e visualização de fotos, renders de revisão e pranchas PDF
CREATE POLICY "mavic_files_public_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'mavic_files');

CREATE POLICY "mavic_files_public_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'mavic_files');

CREATE POLICY "mavic_files_public_update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'mavic_files')
WITH CHECK (bucket_id = 'mavic_files');

CREATE POLICY "mavic_files_public_delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'mavic_files');
