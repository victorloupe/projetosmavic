# Migração: um registro por linha (mavic_records)

## O que mudou
- **Antes:** projetos, clientes, orçamentos etc. eram cada um um JSON único em `mavic_store`.
  Qualquer dispositivo que salvasse reenviava a lista inteira, e o último a salvar apagava as
  alterações dos outros (o problema do celular).
- **Agora:** cada registro é uma linha em `mavic_records` (`collection`, `id`, `data`).
  - O app envia só os registros que mudaram, e apaga só os que foram excluídos neste aparelho (`sync.js`).
  - O Realtime aplica as mudanças dos outros aparelhos registro a registro.
  - Edições feitas offline são reaplicadas ao reabrir o app, sem desfazer o que os outros fizeram.
- `mavic_store` continua com a linha `config` (colunas, modelos, Pix). As outras linhas ficam como
  backup congelado de antes da migração.

## Ordem de implantação (fazer tudo em sequência, ~10 min)
1. **Feche o painel** em todos os aparelhos (celular inclusive). Não edite nada até o passo 5.
2. **SQL Editor:** rode `supabase/migracao_mavic_records.sql`. A tabela no final deve mostrar
   as mesmas quantidades em `mavic_records` e em `mavic_store (antigo)`.
3. **Edge Functions → cliente-data → Code:** cole o novo `index.ts` e clique em Deploy.
4. **Vercel:** publique o site (commit + push).
5. Abra o painel e confira os projetos. No celular, abra e recarregue uma vez.

## Teste rápido
- Notebook e celular abertos ao mesmo tempo: mova um card em um e veja aparecer no outro.
- Edite projetos diferentes nos dois aparelhos: as duas edições devem permanecer.
- Portal do cliente: abrir o link, aprovar ou pedir ajuste.

## Se algo der errado
O app nunca apaga dados em massa: se `mavic_records` estiver vazia ou sem permissão, ele entra em
modo offline. Os dados antigos continuam intactos em `mavic_store`. Para voltar à versão anterior,
basta reverter o commit na Vercel e republicar a Edge Function antiga.

## Testes automatizados
`node tests/sync.test.js sync.js` simula dois aparelhos (edições simultâneas, exclusão,
edição offline, lista vazia, conflito).
