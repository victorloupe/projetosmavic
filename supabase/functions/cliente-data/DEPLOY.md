# Como publicar a Edge Function no Supabase

## Por que isso é necessário?

Antes desta mudança, o `cliente.html` baixava **todos** os dados do banco e filtrava
no browser — qualquer cliente podia abrir o DevTools e ver projetos e dados de todos
os outros clientes.

Agora o `cliente.js` faz `fetch()` para esta Edge Function, que roda no servidor
Supabase, valida o token, e devolve **apenas** os dados daquele cliente.

---

## Passo a passo no Supabase Dashboard (sem CLI)

1. Acesse https://supabase.com/dashboard e abra o projeto **MAVIC**.

2. No menu lateral, clique em **Edge Functions** → **Deploy new function**.

3. Dê o nome: `cliente-data`

4. Cole o conteúdo do arquivo `index.ts` desta pasta no editor.

5. Clique em **Deploy**.

6. Aguarde o status mudar para **Active**.

### Verificar se funcionou

Abra no browser:
```
https://ygwrpwkkriaeqaeuuxan.supabase.co/functions/v1/cliente-data?nome=NOME_DO_CLIENTE
```

Deve retornar um JSON com os projetos filtrados (ou `{"error":"client_not_found"}`
se o nome não existir).

---

## Variáveis de ambiente (já configuradas automaticamente)

A Edge Function usa:
- `SUPABASE_URL` — preenchido automaticamente pelo Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — preenchido automaticamente pelo Supabase

A **service role key** fica apenas no servidor e **nunca chega ao browser**.

---

## O que muda para os clientes?

Nada de visível. O painel continua igual. A diferença é que agora:
- O token é validado no servidor (não pode ser bypassado)
- Cada cliente recebe apenas seus próprios dados
- A chave do Supabase não aparece mais no código do browser

---

## Atualização de segurança (nov/2026) — ORDEM OBRIGATÓRIA

O banco deixou de ser público. Faça nesta ordem para não derrubar o portal:

1. **Republicar esta Edge Function** com o `index.ts` atualizado
   (Edge Functions → `cliente-data` → editar → colar → Deploy).
   Mudanças: token agora é obrigatório, aprovação/ajuste corrigidos, notificação de ajuste para o painel.
2. **Publicar o site** (push para a Vercel) com o novo `cliente.js` — o portal passa a usar só esta função.
3. **Testar o portal** com o link de um cliente (abrir, aprovar/solicitar ajuste em um projeto de teste).
4. **Desativar cadastro público**: Authentication → Sign In / Providers → desmarcar "Allow new users to sign up".
5. **Rodar `supabase/schema_and_rls.sql`** no SQL Editor (fecha a tabela `mavic_store` e o Storage para quem não está logado).
6. **Testar o painel**: sair e entrar de novo no login, abrir o quadro, mover um card, enviar uma imagem.

Se algo der errado no passo 6, o painel volta a funcionar rodando temporariamente no SQL Editor:
`CREATE POLICY "tmp_publico" ON public.mavic_store FOR ALL TO public USING (true) WITH CHECK (true);`
(e apague essa política depois de corrigir).
