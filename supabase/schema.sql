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

-- ─── DESPESAS (extrato financeiro por proprietário) ───
-- Receitas vêm dos lançamentos; despesas operacionais (lavagem, óleo, pneus,
-- manutenção, etc.) são registradas aqui, por dono e mês de competência.
create table if not exists public.despesas (
  id          bigint generated always as identity primary key,
  dono        text,
  mes         text,            -- competência 'YYYY-MM'
  categoria   text,            -- Lavagem, Troca de óleo, Pneus, Outros...
  descricao   text,            -- texto livre (obrigatório quando categoria = 'Outros')
  valor       numeric(12,2),
  data        date,
  created_at  timestamptz default now()
);

create index if not exists idx_despesas_dono on public.despesas (dono);
create index if not exists idx_despesas_mes on public.despesas (mes);

alter table public.despesas enable row level security;

-- Mesma política liberal da tabela de lançamentos (veja a observação acima).
drop policy if exists "anon full access despesas" on public.despesas;
create policy "anon full access despesas"
  on public.despesas
  for all
  to anon
  using (true)
  with check (true);

-- ─── SALDOS (saldo transportado por proprietário/mês) ───
-- Guarda o saldo de abertura informado manualmente para um mês. Quando não há
-- registro, o saldo de abertura é o resultado final (transportado) do mês anterior.
create table if not exists public.saldos (
  id          bigint generated always as identity primary key,
  dono        text,
  mes         text,            -- competência 'YYYY-MM'
  valor       numeric(12,2),
  created_at  timestamptz default now(),
  unique (dono, mes)
);

create index if not exists idx_saldos_dono on public.saldos (dono);
create index if not exists idx_saldos_mes on public.saldos (mes);

alter table public.saldos enable row level security;

-- Mesma política liberal das demais tabelas (veja a observação acima).
drop policy if exists "anon full access saldos" on public.saldos;
create policy "anon full access saldos"
  on public.saldos
  for all
  to anon
  using (true)
  with check (true);

-- ─── VEÍCULOS (frota: cada carro e seu proprietário) ───
-- Cadastro central dos carros. O app lê esta tabela na aba "Premissas" para
-- listar, incluir, editar e excluir veículos e alterar o proprietário de cada
-- um. Na primeira vez (tabela vazia) o app popula automaticamente a partir das
-- placas já existentes nos lançamentos. Para semear manualmente, use
-- supabase/veiculos.sql.
create table if not exists public.veiculos (
  id          bigint generated always as identity primary key,
  placa       text not null,
  dono        text,
  modelo      text,
  created_at  timestamptz default now(),
  unique (placa)
);

create index if not exists idx_veiculos_dono on public.veiculos (dono);

alter table public.veiculos enable row level security;

-- Mesma política liberal das demais tabelas (veja a observação acima).
drop policy if exists "anon full access veiculos" on public.veiculos;
create policy "anon full access veiculos"
  on public.veiculos
  for all
  to anon
  using (true)
  with check (true);
