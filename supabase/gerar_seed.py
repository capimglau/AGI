#!/usr/bin/env python3
"""Gera supabase/seed.sql, supabase/veiculos.sql e supabase/setup.sql
a partir de rentabilidade_IA.xlsx.

REGRA DA CARGA: os VALORES (valor, valor pago e saldo) entram exatamente como
estão na planilha — nenhum é recalculado, arredondado ou substituído, e célula
vazia vira NULL, não zero. Os totais no banco batem centavo a centavo com a
planilha; o script confere isso no fim e aborta se não bater.

As correções ficam restritas a campos que não são valor:
  1. placa em maiúsculas e sem espaços, unificando grafias do mesmo carro;
  2. dono em branco completado pela frota (tabela veiculos);
  3. "Crédito 90/60 dias" -> "Crédito 3x"/"Crédito 2x", os rótulos que os
     formulários do app usam (a taxa é a mesma);
  4. datas digitadas errado, corrigidas caso a caso (tabela FIX_DATA);
  5. vencimento de lançamento PENDENTE que cai em sábado ou domingo passa
     para a segunda-feira seguinte — mesma regra do proxUtil/
     fixWeekendVencimentos do app. Já baixado não é tocado.

Uso (na raiz do repositório):  python3 supabase/gerar_seed.py
Requer:  pip install openpyxl

Ver supabase/README-import.md para a conferência da carga.
"""
import openpyxl, re, datetime, io, os

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(REPO, 'rentabilidade_IA.xlsx')

# ── frota já cadastrada (placa → dono) ──
vtxt = open(f'{REPO}/supabase/veiculos.sql', encoding='utf-8').read()
FROTA = {}
for placa, dono in re.findall(r"\('([^']+)',\s*'([^']+)'\)", vtxt):
    FROTA[placa.upper()] = dono
FROTA_ORDEM = [p for p, _ in re.findall(r"\('([^']+)',\s*'([^']+)'\)", vtxt)]

# ── datas digitadas errado na planilha (célula de texto, não data) ──
# chave = texto exato da célula; valor = data corrigida ou None para NULL
FIX_DATA = {
    '10/1/026': '2026-01-10',   # ano digitado como "026"
    '8u24/3':   '2026-03-24',   # tecla presa antes de 24/3 (+30 dias = 23/04, o retorno)
    '14/6.':    '2026-06-14',   # ponto sobrando
    'multa':    None,           # não é data: é um lançamento do tipo Multas
}

def norm_data(v, ctx, avisos):
    """Célula de data → 'YYYY-MM-DD'. Célula de texto só passa se estiver na
    FIX_DATA; qualquer outro texto derruba a geração, para não entrar nada
    adivinhado sem alguém ter olhado."""
    if v is None:
        return None
    if hasattr(v, 'year'):
        return v.strftime('%Y-%m-%d')
    t = str(v).strip()
    if not t:
        return None
    if t in FIX_DATA:
        avisos.append(f'{ctx}: "{t}" → {FIX_DATA[t] or "NULL"}')
        return FIX_DATA[t]
    raise SystemExit(f'ERRO: {ctx} tem o texto {t!r}, que não é data nem está '
                     f'na tabela FIX_DATA. Corrija a planilha ou a tabela.')

def norm_placa(p):
    """Maiúsculas e sem espaços. A planilha grafa o mesmo carro de várias
    formas (SVMle/SVMLe/SVMLE); assim todas caem na mesma placa."""
    return str(p or '').strip().upper().replace(' ', '')

def norm_forma(f):
    """'Crédito 90/60 dias' é o mesmo parcelamento de 'Crédito 3x'/'Crédito 2x'
    (mesma taxa em getTaxaForma), mas só esses rótulos existem nos formulários
    do app."""
    fl = str(f or '').strip().lower()
    if fl in ('crédito 90 dias', 'credito 90 dias', 'crédito 3x', 'credito 3x'):
        return 'Crédito 3x'
    if fl in ('crédito 60 dias', 'credito 60 dias', 'crédito 2x', 'credito 2x'):
        return 'Crédito 2x'
    return str(f or '').strip()

def prox_util(iso):
    """Sábado/domingo → segunda-feira seguinte (proxUtil do app)."""
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

def txt(v):
    """Texto como está na célula; célula vazia vira NULL."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None

def num(v):
    """VALOR: entra como está na célula. Vazio vira NULL, nunca zero."""
    return None if v is None or str(v).strip() == '' else float(v)

regs, avisos = [], []
for n, r in enumerate(linhas, 2):
    placa = norm_placa(r[0])
    dono = txt(r[1])
    if dono is None:
        dono = FROTA.get(placa, 'Indefinido')
        avisos.append(f'linha {n} · dono em branco → "{dono}" (frota) · {placa}')
    prev = norm_data(r[8], f'linha {n} · prev. pgto', avisos)
    saldo = num(r[10])
    # pendente que vence em fim de semana → segunda-feira
    if prev and saldo is not None and saldo > 0.005:
        novo = prox_util(prev)
        if novo != prev:
            avisos.append(f'linha {n} · vencimento {prev} (fim de semana) → {novo}')
            prev = novo
    regs.append(dict(
        placa=placa, dono=dono,
        saida=norm_data(r[2], f'linha {n} · saída', avisos),
        retorno=norm_data(r[3], f'linha {n} · retorno', avisos),
        cliente=txt(r[4]), tipo=txt(r[5]) or 'Locação', valor=num(r[6]),
        forma=norm_forma(r[7]), prev_pgto=prev,
        valor_pago=num(r[9]), saldo=saldo, obs=txt(r[11]),
    ))

# ── trava: os valores no banco têm de bater com os da planilha ──
def col(idx):
    return sum(float(l[idx]) for l in linhas if l[idx] is not None)

for campo, idx in (('valor', 6), ('valor_pago', 9), ('saldo', 10)):
    na_planilha = round(col(idx), 2)
    no_banco = round(sum(g[campo] for g in regs if g[campo] is not None), 2)
    if na_planilha != no_banco:
        raise SystemExit(f'ERRO: total de {campo} não bate — planilha '
                         f'{na_planilha:.2f} x carga {no_banco:.2f}')
    linha_a_linha = [n for n, (l, g) in enumerate(zip(linhas, regs), 2)
                     if (l[idx] is None) != (g[campo] is None)
                     or (l[idx] is not None and float(l[idx]) != g[campo])]
    if linha_a_linha:
        raise SystemExit(f'ERRO: {campo} diferente da planilha nas linhas {linha_a_linha[:10]}')

# ── frota: mantém a ordem atual e acrescenta as placas novas da planilha ──
# A placa entra na frota como aparece na planilha; quando a mesma placa só
# muda de caixa (SVMle/SVMLE), o carro já cadastrado é reaproveitado.
frota = [(p, FROTA[p.upper()]) for p in FROTA_ORDEM]
novas = []
for g in regs:
    p = (g['placa'] or '').strip()
    if p and p.upper() not in FROTA:
        dono = (g['dono'] or '').strip() or 'Indefinido'
        FROTA[p.upper()] = dono
        novas.append(p)
        frota.append((p, dono))

n0 = lambda v: 0.0 if v is None else float(v)
TOTAL = len(regs)
PEND = sum(1 for g in regs if n0(g['saldo']) > 0.005)
V_TOT = sum(n0(g['valor']) for g in regs)
V_PEND = sum(n0(g['saldo']) for g in regs if n0(g['saldo']) > 0.005)
V_PAGO = sum(n0(g['valor_pago']) for g in regs)
SEM_SAIDA = sum(1 for g in regs if g['saida'] is None)
SEM_DONO = sum(1 for g in regs if g['dono'] is None)

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
    out.write(',\n'.join(f'  ({sql_txt(p)}, {sql_txt(d)})' for p, d in frota))
    out.write('\non conflict (placa) do nothing;\n')
    return out.getvalue()

CAB_SEED = f"""-- AutoGest Pro · seed de dados ({TOTAL} lançamentos)
-- Gerado a partir da planilha rentabilidade_IA.xlsx.
-- Execute APÓS schema.sql no SQL Editor do Supabase.
--
-- VALORES IDÊNTICOS À PLANILHA: valor, valor pago e saldo entram exatamente
-- como estão lá, sem recalcular nem arredondar, e célula vazia vira NULL (não
-- zero). O gerador confere linha a linha e não escreve nada se algum valor
-- divergir.
--
-- Resumo da carga:
--   • {TOTAL} lançamentos, de 01/2026 a 11/2026 (por Prev. Pgto)
--   • {TOTAL - PEND} baixados  ·  {PEND} pendentes
--   • faturado R$ {brl(V_TOT)}  ·  recebido R$ {brl(V_PAGO)}  ·  a receber R$ {brl(V_PEND)}
--
-- Correções aplicadas (nenhuma mexe em valor):
--   • placa em maiúsculas e sem espaços — a planilha grafa o mesmo carro como
--     "SVMle"/"SVMLe"/"SVMLE";
--   • dono em branco completado pela frota ({SEM_DONO} registros);
--   • "Crédito 90 dias" → "Crédito 3x" e "Crédito 60 dias" → "Crédito 2x",
--     rótulos dos formulários do app (mesma taxa);
--   • datas digitadas errado corrigidas; o que não é data ficou NULL
--     ({SEM_SAIDA} registros sem saída);
--   • vencimento de pendente em sábado/domingo passa para segunda-feira.
-- Conferência completa em supabase/README-import.md.

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
-- Cópia fiel da planilha rentabilidade_IA.xlsx (célula vazia = NULL).
--   {TOTAL - PEND} baixados · {PEND} pendentes
--   faturado R$ {brl(V_TOT)} · recebido R$ {brl(V_PAGO)} · a receber R$ {brl(V_PEND)}

truncate table public.lancamentos restart identity;

{bloco_lancamentos()}"""
with open(f'{REPO}/supabase/setup.sql', 'w', encoding='utf-8') as f:
    f.write(setup)

print(f'lançamentos: {TOTAL} ({TOTAL-PEND} baixados, {PEND} pendentes)')
print(f'frota: {len(frota)} veículos (placas novas: {novas or "nenhuma"})')
print(f'faturado {V_TOT:.2f} | recebido {V_PAGO:.2f} | a receber {V_PEND:.2f}')
print(f'sem dono: {SEM_DONO} | sem saída: {SEM_SAIDA}')
print('--- células de data em texto ---')
for a in avisos:
    print(' ', a)
