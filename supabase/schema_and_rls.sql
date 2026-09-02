-- ==============================================================================
-- MAVIC Projetos — Configuração de Segurança, RLS e Supabase Storage
-- Execute este script no SQL Editor do seu painel Supabase (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Garante que a tabela mavic_store existe
CREATE TABLE IF NOT EXISTS public.mavic_store (
    key text PRIMARY KEY,
    data jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- 2. Habilita o Row Level Security (RLS) na tabela mavic_store
ALTER TABLE public.mavic_store ENABLE ROW LEVEL SECURITY;

-- 3. Remove políticas antigas caso existam (para evitar duplicatas)
DROP POLICY IF EXISTS "Permitir leitura anonima" ON public.mavic_store;
DROP POLICY IF EXISTS "Permitir escrita anonima" ON public.mavic_store;
DROP POLICY IF EXISTS "Admin acesso total" ON public.mavic_store;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.mavic_store;

-- 4. Cria política de ACESSO TOTAL exclusivo para usuários AUTENTICADOS (Admins logados)
CREATE POLICY "Admin acesso total"
ON public.mavic_store
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Habilita publicação em Realtime para atualizações automáticas entre abas e dispositivos
ALTER PUBLICATION supabase_realtime ADD TABLE public.mavic_store;


-- ==============================================================================
-- 6. CONFIGURAÇÃO DO SUPABASE STORAGE (Bucket 'mavic_files')
-- Permite armazenar capas de projetos e anexos de orçamentos como arquivos na nuvem
-- em vez de Base64, evitando limites de memória no LocalStorage.
-- ==============================================================================

-- Garante a criação do bucket público 'mavic_files' com limite de 50MB
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('mavic_files', 'mavic_files', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

-- Remove políticas antigas do Storage se existirem
DROP POLICY IF EXISTS "Storage Leitura Publica" ON storage.objects;
DROP POLICY IF EXISTS "Storage Upload Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Storage Update Autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Storage Delete Autenticado" ON storage.objects;

-- Leitura pública para que fotos de capa e anexos carreguem no painel e no portal do cliente
CREATE POLICY "Storage Leitura Publica"
ON storage.objects FOR SELECT
USING (bucket_id = 'mavic_files');

-- Upload permitido apenas para usuários autenticados (Admin logado)
CREATE POLICY "Storage Upload Autenticado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mavic_files');

-- Atualização e exclusão de arquivos permitidas para Admin logado
CREATE POLICY "Storage Update Autenticado"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'mavic_files');

CREATE POLICY "Storage Delete Autenticado"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'mavic_files');
