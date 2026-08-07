#!/usr/bin/env python3
"""Gera supabase/seed.sql, supabase/veiculos.sql e supabase/setup.sql
a partir de rentabilidade_IA.xlsx, seguindo as mesmas regras que o app
aplica na importação de planilha (index.html · handleXls/importXls).

Uso (na raiz do repositório):  python3 supabase/gerar_seed.py
Requer:  pip install openpyxl

O que cada tratamento faz e por quê está em supabase/README-import.md.
"""
import openpyxl, re, datetime, io, os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(REPO, 'rentabilidade_IA.xlsx')

# ── frota já cadastrada (placa → dono), usada para completar donos em branco ──
vtxt = open(f'{REPO}/supabase/veiculos.sql', encoding='utf-8').read()
FROTA = {}
for placa, dono in re.findall(r"\('([^']+)',\s*'([^']+)'\)", vtxt):
    FROTA[placa.upper()] = dono
FROTA_ORDEM = [p for p, _ in re.findall(r"\('([^']+)',\s*'([^']+)'\)", vtxt)]

# ── correções pontuais de datas digitadas errado na planilha ──
# (chave = texto exato encontrado na célula; valor = data ISO ou None p/ NULL)
FIX_DATA = {
    '10/1/026': '2026-01-10',   # ano digitado como "026"
    '8u24/3':   '2026-03-24',   # tecla presa: 24/3 (+30 dias = 23/04 = retorno)
    '14/6.':    '2026-06-14',   # ponto sobrando
    'multa':    None,           # não é data (lançamento de multa)
}

def norm_data(v, ctx):
    if v is None:
        return None
    if hasattr(v, 'year'):
        return v.strftime('%Y-%m-%d')
    t = str(v).strip()
    if not t:
        return None
    if t in FIX_DATA:
        return FIX_DATA[t]
    raise SystemExit(f'data não reconhecida: {t!r} em {ctx}')

def norm_forma(f):
    """Alinha a forma de pagamento às opções do app (index.html · select de
    forma). 'Crédito 90/60 dias' são os mesmos parcelamentos de 'Crédito 3x/2x';
    gravar o rótulo fora da lista faria o modal de edição perder o valor."""
    fl = (f or '').strip().lower()
    if fl in ('crédito 90 dias', 'credito 90 dias', 'crédito 3x', 'credito 3x'):
        return 'Crédito 3x'
    if fl in ('crédito 60 dias', 'credito 60 dias', 'crédito 2x', 'credito 2x'):
        return 'Crédito 2x'
    return (f or '').strip()

def prox_util(iso):
    """Vencimento em sábado/domingo vai para a segunda-feira — mesma regra do
    proxUtil()/fixWeekendVencimentos() do app."""
    d = datetime.date.fromisoformat(iso)
    if d.weekday() == 5:
        d += datetime.timedelta(days=2)
    elif d.weekday() == 6:
        d += datetime.timedelta(days=1)
    return d.isoformat()

def brl(v):
    """1028879.28 -> '1.028.879,28' (formato brasileiro, para os comentários)."""
    return f'{v:,.2f}'.translate(str.maketrans({',': '.', '.': ','}))

def sql_txt(v):
    return 'NULL' if v is None else "'" + str(v).replace("'", "''") + "'"

def sql_num(v):
    return 'NULL' if v is None else f'{round(float(v), 2):.2f}'

# ── leitura ──
ws = openpyxl.load_workbook(XLSX, data_only=True)['Planilha1']
linhas = list(ws.iter_rows(min_row=2, values_only=True))

regs, alertas = [], []
for n, r in enumerate(linhas, 2):
    placa = str(r[0] or '').strip().upper().replace(' ', '')
    dono = str(r[1] or '').strip()
    if not dono:
        dono = FROTA.get(placa, 'Indefinido')
        alertas.append(f'linha {n}: dono em branco → "{dono}" (frota) · {placa}')
    saida = norm_data(r[2], f'linha {n} saída')
    retorno = norm_data(r[3], f'linha {n} retorno')
    cliente = str(r[4] or '').strip()
    tipo = str(r[5] or '').strip() or 'Locação'
    valor = round(float(r[6] or 0), 2)
    forma = norm_forma(r[7])
    prev = norm_data(r[8], f'linha {n} prev. pgto')
    saldo = round(float(r[10] or 0), 2)
    pago = round(float(r[9]), 2) if r[9] is not None else 0.0
    obs = r[11]
    obs = None if obs is None or not str(obs).strip() else str(obs).strip()
    # pendente com vencimento em fim de semana: empurra p/ segunda (o app faria
    # isso sozinho no primeiro carregamento). Quitados ficam como na planilha.
    if prev and saldo > 0.005:
        prev = prox_util(prev)
    regs.append(dict(placa=placa, dono=dono, saida=saida, retorno=retorno,
                     cliente=cliente, tipo=tipo, valor=valor, forma=forma,
                     prev_pgto=prev, valor_pago=pago, saldo=saldo, obs=obs))

# ── frota: mantém a ordem atual e acrescenta as placas novas da planilha ──
frota = list(FROTA_ORDEM)
novas = []
for g in regs:
    if g['placa'] not in FROTA and g['placa'] not in novas:
        novas.append(g['placa'])
        FROTA[g['placa']] = g['dono']
frota += novas

TOTAL = len(regs)
PEND = sum(1 for g in regs if g['saldo'] > 0.005)
V_TOT = sum(g['valor'] for g in regs)
V_PEND = sum(g['saldo'] for g in regs if g['saldo'] > 0.005)
V_PAGO = sum(g['valor_pago'] for g in regs)

def bloco_lancamentos():
    out = io.StringIO()
    out.write('insert into public.lancamentos (placa, dono, saida, retorno, '
              'cliente, tipo, valor, forma, prev_pgto, valor_pago, saldo, obs) values\n')
    linhas_sql = []
    for g in regs:
        linhas_sql.append(
            '  (' + ', '.join([
                sql_txt(g['placa']), sql_txt(g['dono']), sql_txt(g['saida']),
                sql_txt(g['retorno']), sql_txt(g['cliente']), sql_txt(g['tipo']),
                sql_num(g['valor']), sql_txt(g['forma']), sql_txt(g['prev_pgto']),
                sql_num(g['valor_pago']), sql_num(g['saldo']), sql_txt(g['obs']),
            ]) + ')')
    out.write(',\n'.join(linhas_sql) + ';\n')
    return out.getvalue()

def bloco_veiculos():
    out = io.StringIO()
    out.write('insert into public.veiculos (placa, dono) values\n')
    out.write(',\n'.join(f"  ({sql_txt(p)}, {sql_txt(FROTA[p])})" for p in frota))
    out.write('\non conflict (placa) do nothing;\n')
    return out.getvalue()

CAB_SEED = f"""-- AutoGest Pro · seed de dados ({TOTAL} lançamentos)
-- Gerado a partir da planilha rentabilidade_IA.xlsx.
-- Execute APÓS schema.sql no SQL Editor do Supabase.
--
-- Resumo da carga:
--   • {TOTAL} lançamentos, de 01/2026 a 11/2026 (por Prev. Pgto)
--   • {TOTAL - PEND} baixados  ·  {PEND} pendentes
--   • faturado R$ {brl(V_TOT)}  ·  recebido R$ {brl(V_PAGO)}  ·  a receber R$ {brl(V_PEND)}
--
-- Tratamentos aplicados na conversão (mesmas regras do app):
--   • placa em MAIÚSCULAS e sem espaços (a planilha traz variações como
--     "SVMle"/"SVMLe"/"SVMLE" para o mesmo carro);
--   • dono em branco é completado pela frota (tabela veiculos); sem
--     correspondência vira "Indefinido";
--   • "Crédito 90 dias" → "Crédito 3x" e "Crédito 60 dias" → "Crédito 2x",
--     que são os rótulos usados nos formulários do app (mesma taxa);
--   • valor_pago vazio grava 0,00 (todos esses registros estão pendentes,
--     com saldo > 0);
--   • vencimento de pendente que cai em sábado/domingo passa para a
--     segunda-feira, como o app já faz ao carregar;
--   • datas digitadas com erro de digitação foram corrigidas ou deixadas
--     nulas — ver comentários no arquivo supabase/README-import.md.

truncate table public.lancamentos restart identity;

"""

with open(f'{REPO}/supabase/seed.sql', 'w', encoding='utf-8') as f:
    f.write(CAB_SEED + bloco_lancamentos())

# ── veiculos.sql: preserva o cabeçalho/DDL atual, troca só a carga ──
cabecalho_v = vtxt.split('-- ─── Carga inicial da frota')[0]
with open(f'{REPO}/supabase/veiculos.sql', 'w', encoding='utf-8') as f:
    f.write(cabecalho_v
            + f'-- ─── Carga inicial da frota ({len(frota)} veículos: placa → proprietário) ───\n'
            + bloco_veiculos())

# ── setup.sql: schema + boleto_feito + data_pagamento + frota + lançamentos ──
schema = open(f'{REPO}/supabase/schema.sql', encoding='utf-8').read()
schema = schema.split('\n', 2)[2].lstrip('\n')  # tira as 2 linhas de título
setup = f"""-- ─────────────────────────────────────────────────────────────
--  AutoGest Pro (AGI) · INSTALAÇÃO COMPLETA
-- ─────────────────────────────────────────────────────────────
--  Script único para colocar um banco novo do Supabase no ar.
--  Cole tudo no SQL Editor do Supabase e clique em RUN.
--
--  Ele cria as 4 tabelas (lancamentos, despesas, saldos, veiculos)
--  com as políticas de acesso, e já carrega a frota ({len(frota)} veículos)
--  e os {TOTAL} lançamentos da planilha rentabilidade_IA.
--
--  ATENÇÃO: o passo dos lançamentos começa com TRUNCATE — rodar este
--  script de novo apaga e recarrega os lançamentos. Em banco novo é
--  exatamente o que se quer; em banco em uso, pule a PARTE 5.
--
--  Depois de rodar: copie a Project URL e a chave anon public em
--  Project Settings → API e cole no config.js na raiz do repositório.
-- ─────────────────────────────────────────────────────────────


-- ═══════════ PARTE 1 · TABELAS E POLÍTICAS ═══════════

{schema}

-- ═══════════ PARTE 2 · COLUNA boleto_feito ═══════════
-- Guarda, por lançamento de boleto, se o boleto já foi emitido.

alter table public.lancamentos
  add column if not exists boleto_feito boolean not null default false;


-- ═══════════ PARTE 3 · COLUNA data_pagamento ═══════════
-- Data em que a baixa foi feita (separada do campo obs).

alter table public.lancamentos
  add column if not exists data_pagamento date;


-- ═══════════ PARTE 4 · FROTA ({len(frota)} veículos) ═══════════

{bloco_veiculos()}

-- ═══════════ PARTE 5 · LANÇAMENTOS ({TOTAL} registros) ═══════════
-- Dados da planilha rentabilidade_IA.xlsx.
--   {TOTAL - PEND} baixados · {PEND} pendentes
--   faturado R$ {brl(V_TOT)} · recebido R$ {brl(V_PAGO)} · a receber R$ {brl(V_PEND)}

truncate table public.lancamentos restart identity;

{bloco_lancamentos()}"""
with open(f'{REPO}/supabase/setup.sql', 'w', encoding='utf-8') as f:
    f.write(setup)

print(f'lançamentos: {TOTAL} ({TOTAL-PEND} baixados, {PEND} pendentes)')
print(f'frota: {len(frota)} veículos (novas: {novas})')
print(f'faturado {V_TOT:.2f} | recebido {V_PAGO:.2f} | a receber {V_PEND:.2f}')
print('--- alertas ---')
for a in alertas:
    print(' ', a)
