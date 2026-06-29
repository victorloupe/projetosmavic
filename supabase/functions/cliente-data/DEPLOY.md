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
