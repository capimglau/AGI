-- AutoGest Pro · login (Supabase Auth), perfis de usuário e log de auditoria
-- Execute uma vez no SQL Editor do Supabase (projeto já em uso).
--
-- IMPORTANTE — isso NÃO tranca o banco: as políticas "anon full access" das
-- tabelas antigas (lancamentos, despesas, saldos, veiculos) continuam ativas.
-- Este script só ACRESCENTA a possibilidade de acesso autenticado, criando
-- também as políticas "to authenticated" que faltam nelas — sem isso, quem
-- fizesse login perderia acesso (RLS nega por padrão quando não há política
-- pro papel da requisição). Quando estiver pronto para exigir login de
-- verdade, revogue as políticas "anon" dessas 4 tabelas — aí sim o banco
-- fica fechado pra quem não estiver logado.

-- ─── PERFIS (nome, foto, vínculo com o login) ───
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  foto_url    text,            -- data URL (base64) da foto de perfil
  criado_em   timestamptz default now(),
  atualizado_em timestamptz default now()
);

alter table public.perfis enable row level security;

drop policy if exists "perfis: leitura por qualquer autenticado" on public.perfis;
create policy "perfis: leitura por qualquer autenticado"
  on public.perfis for select
  to authenticated
  using (true);

drop policy if exists "perfis: cada um edita o próprio" on public.perfis;
create policy "perfis: cada um edita o próprio"
  on public.perfis for all
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ─── AUDITORIA (quem fez o quê, quando) ───
create table if not exists public.auditoria (
  id            bigint generated always as identity primary key,
  usuario_id    uuid,
  usuario_nome  text,            -- e-mail (ou "Anônimo" se ninguém logado)
  acao          text not null,   -- 'criação' | 'atualização' | 'exclusão'
  tabela        text not null,
  registro_id   text,
  dados         jsonb,           -- snapshot do registro após a ação (null em exclusão)
  criado_em     timestamptz default now()
);

create index if not exists idx_auditoria_criado_em on public.auditoria (criado_em desc);
create index if not exists idx_auditoria_tabela on public.auditoria (tabela);

alter table public.auditoria enable row level security;

-- Liberal como as demais tabelas do projeto (ver observação no topo do
-- schema.sql): qualquer um grava e lê o log, autenticado ou não — assim o
-- log continua funcionando mesmo enquanto o banco não estiver travado.
drop policy if exists "auditoria: leitura" on public.auditoria;
create policy "auditoria: leitura"
  on public.auditoria for select
  to anon, authenticated
  using (true);

drop policy if exists "auditoria: escrita" on public.auditoria;
create policy "auditoria: escrita"
  on public.auditoria for insert
  to anon, authenticated
  with check (true);

-- ─── Acesso autenticado às tabelas existentes (só ADITIVO — anon continua) ───
drop policy if exists "authenticated full access lancamentos" on public.lancamentos;
create policy "authenticated full access lancamentos"
  on public.lancamentos for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated full access despesas" on public.despesas;
create policy "authenticated full access despesas"
  on public.despesas for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated full access saldos" on public.saldos;
create policy "authenticated full access saldos"
  on public.saldos for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated full access veiculos" on public.veiculos;
create policy "authenticated full access veiculos"
  on public.veiculos for all
  to authenticated
  using (true)
  with check (true);
