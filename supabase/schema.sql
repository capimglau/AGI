-- AutoGest Pro · esquema do banco (Supabase / Postgres)
-- Execute este script primeiro, no SQL Editor do Supabase.

create table if not exists public.lancamentos (
  id          bigint generated always as identity primary key,
  placa       text,
  dono        text,
  saida       date,
  retorno     date,
  cliente     text,
  tipo        text,
  valor       numeric(12,2),
  forma       text,
  prev_pgto   date,
  valor_pago  numeric(12,2),
  saldo       numeric(12,2),
  obs         text,
  created_at  timestamptz default now()
);

-- índices úteis para os filtros do app
create index if not exists idx_lancamentos_prev_pgto on public.lancamentos (prev_pgto);
create index if not exists idx_lancamentos_dono on public.lancamentos (dono);
create index if not exists idx_lancamentos_placa on public.lancamentos (placa);

-- Row Level Security
alter table public.lancamentos enable row level security;

-- ATENÇÃO: esta política libera leitura e escrita para a chave ANÔNIMA (pública).
-- É o suficiente para colocar o sistema no ar rapidamente, mas QUALQUER pessoa
-- com a URL do site poderá ler/editar os dados. Para uso real, troque por
-- autenticação (Supabase Auth) e restrinja as políticas. Veja o README.
drop policy if exists "anon full access" on public.lancamentos;
create policy "anon full access"
  on public.lancamentos
  for all
  to anon
  using (true)
  with check (true);
