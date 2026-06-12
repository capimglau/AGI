-- AutoGest Pro · coluna "boleto_feito" na tabela de lançamentos
-- ─────────────────────────────────────────────────────────────
-- Guarda, por lançamento de boleto, se o boleto já foi emitido/feito.
-- O app marca/desmarca isso no modal "Boletos do Mês". Sem esta coluna
-- a marcação funciona na sessão, mas não persiste ao recarregar.
--
-- Rode no SQL Editor do Supabase.
-- ─────────────────────────────────────────────────────────────

alter table public.lancamentos
  add column if not exists boleto_feito boolean not null default false;
