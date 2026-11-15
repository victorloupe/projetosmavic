-- ==============================================================================
-- MAVIC Projetos — Migração para registros individuais (tabela mavic_records)
--
-- Antes: cada tipo de dado (projetos, clientes...) era UM JSON gigante em mavic_store.
--        Quem salvava por último sobrescrevia tudo (problema do celular).
-- Agora: cada projeto/cliente/orçamento/serviço/notificação/aviso é uma linha.
--        O app envia só o que mudou.
--
-- A tabela mavic_store CONTINUA existindo:
--   * a linha key='config' segue sendo usada (colunas, modelos, Pix...);
--   * as demais linhas ficam como backup congelado do estado antes da migração.
--
-- Pode rodar mais de uma vez: a cópia (passo 4) só acontece se mavic_records estiver vazia,
-- para não ressuscitar registros apagados depois da migração.
-- Execute no SQL Editor do Supabase.
-- ==============================================================================

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.mavic_records (
    collection  text        NOT NULL,
    id          text        NOT NULL,
    data        jsonb       NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection, id),
    CONSTRAINT mavic_records_collection_chk CHECK (
        collection IN ('projects','clients','notifications','global_notices','budgets','services')
    )
);

-- Busca rápida de projetos por cliente (usada pela Edge Function do portal)
CREATE INDEX IF NOT EXISTS mavic_records_project_client_idx
    ON public.mavic_records (lower(trim(data->>'client')))
    WHERE collection = 'projects';

-- 2. Segurança: só usuários logados (painel). O portal usa a Edge Function (service role).
ALTER TABLE public.mavic_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin autenticado acesso total" ON public.mavic_records;
CREATE POLICY "Admin autenticado acesso total"
ON public.mavic_records
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Realtime (atualização entre dispositivos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mavic_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mavic_records;
  END IF;
END $$;

-- 4. Copia os dados atuais do mavic_store (um registro por linha) — só na primeira vez
INSERT INTO public.mavic_records (collection, id, data)
SELECT DISTINCT ON (s.key, e->>'id')
       s.key, e->>'id', e
FROM public.mavic_store s
CROSS JOIN LATERAL jsonb_array_elements(s.data) AS e
WHERE s.key IN ('projects','clients','notifications','global_notices','budgets','services')
  AND jsonb_typeof(s.data) = 'array'
  AND jsonb_typeof(e) = 'object'
  AND coalesce(e->>'id', '') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.mavic_records)
ORDER BY s.key, e->>'id'
ON CONFLICT (collection, id) DO NOTHING;

-- 5. Conferência: quantidade por tipo nas duas tabelas (os números devem bater)
SELECT 'mavic_records' AS origem, collection AS tipo, count(*) AS qtd
FROM public.mavic_records GROUP BY collection
UNION ALL
SELECT 'mavic_store (antigo)', key, jsonb_array_length(data)
FROM public.mavic_store
WHERE key IN ('projects','clients','notifications','global_notices','budgets','services')
  AND jsonb_typeof(data) = 'array'
ORDER BY tipo, origem;
