# Importação da planilha `rentabilidade_IA.xlsx`

Os arquivos `seed.sql`, `veiculos.sql` e `setup.sql` são **gerados** a partir da
planilha `rentabilidade_IA.xlsx` (raiz do repositório). Este documento registra
o que foi conferido e quais tratamentos foram aplicados na conversão, para que a
carga possa ser refeita ou auditada depois.

## O que entrou

| Item                      | Valor |
|---------------------------|-------|
| Lançamentos               | **753** |
| Baixados                  | 672 |
| Pendentes                 | 81 |
| Faturado                  | R$ 1.028.879,28 |
| Recebido                  | R$ 888.984,35 |
| A receber                 | R$ 136.365,10 |
| Frota (`veiculos`)        | **185** placas |
| Período (por Prev. Pgto)  | 01/2026 a 11/2026 |

Distribuição por mês de vencimento: jan 88 · fev 99 · mar 95 · abr 114 ·
mai 98 · jun 84 · jul 82 · ago 68 · set 18 · out 5 · nov 2.
Todo o pendente está de agosto/2026 em diante — de janeiro a julho tudo
consta como quitado na planilha.

Por proprietário (lançamentos / faturado): Silvio 552 / R$ 837.559,45 ·
Arnaldo 60 / R$ 35.271,79 · Eliana 43 / R$ 54.120,74 · Leandro 42 /
R$ 42.068,90 · Lucélia 30 / R$ 19.582,21 · Silvio 2 18 / R$ 17.737,05 ·
Lorenzo 8 / R$ 22.539,14.

## Tratamentos aplicados

Todos seguem as regras que o próprio app usa ao importar planilha
(`index.html` · `handleXls` / `importXls`).

1. **Placa em MAIÚSCULAS, sem espaços.** A planilha traz o mesmo carro grafado
   de formas diferentes (`SVMle`, `SVMLe`, `SVMLE`; `FKGs`/`FKGS`;
   `SVV5f23`/`SVV5F23`; `SWV1j01`/`SWV1J01`; `TKAs`/`TKAS`; `SIl0000`).
   Normalizando, as 66 grafias viram as **60 placas reais** que aparecem nos
   lançamentos, e todas casam com a frota e com o mapa `PLACA_DONO` do app.
   *Não* foi inserido hífen na placa (o resto do sistema usa a placa sem hífen).

2. **Dono em branco.** 9 lançamentos da placa `UDO2F61` estão sem proprietário
   na planilha. O dono foi completado pela frota já cadastrada, que registra
   `UDO2F61` como da **Lucélia** (mesma informação está em `veiculos.sql` e no
   `PLACA_DONO` do `index.html`). Sem correspondência na frota, o dono viraria
   `Indefinido` — não foi o caso de nenhum registro.

3. **Forma de pagamento.** `Crédito 90 dias` → **`Crédito 3x`** (149 registros)
   e `Crédito 60 dias` → **`Crédito 2x`** (8 registros). São os mesmos
   parcelamentos, com a mesma taxa (`getTaxaForma`), mas escritos como os
   formulários do app esperam; gravar um rótulo fora da lista faria o modal de
   edição perder o valor da forma ao abrir. As demais formas entraram como
   estão: Boleto (460), Crédito (85), Depósito (32), Débito (17), Dinheiro (2).

4. **Valor pago vazio.** 81 registros não têm `Valor Pago` preenchido — são
   exatamente os 81 com saldo em aberto. Entraram com `valor_pago = 0,00` e o
   saldo da planilha. Não há nenhum caso ambíguo (nenhuma linha com valor pago
   vazio e saldo zerado, nem com valor pago preenchido e saldo em aberto).

5. **Vencimento em fim de semana.** 35 pendentes venciam num sábado ou domingo;
   passaram para a segunda-feira seguinte. É a mesma correção que o app aplica
   sozinho ao carregar (`proxUtil` / `fixWeekendVencimentos`) — fazer aqui só
   evita uma rajada de updates no primeiro acesso. Registros já quitados
   ficaram com a data original da planilha.

6. **Datas com erro de digitação.** Quatro células da planilha não eram datas
   válidas:

   | Linha | Campo   | Planilha  | Gravado      | Por quê |
   |-------|---------|-----------|--------------|---------|
   | 57    | Retorno | `10/1/026` | `2026-01-10` | ano digitado com um zero a mais |
   | 318   | Saída   | `8u24/3`   | `2026-03-24` | tecla presa; 24/03 + 30 dias = 23/04, que é o retorno |
   | 633   | Saída   | `14/6.`    | `2026-06-14` | ponto sobrando |
   | 388   | Saída e Retorno | `multa` | `NULL` | não é data — é um lançamento do tipo Multas |

   A linha 670 (também tipo Multas) já vinha sem saída e sem retorno e ficou
   com `NULL` nos dois campos. No total: **2 registros sem data de saída/retorno**,
   ambos de multa. Nenhum registro ficou sem `prev_pgto`.

7. **Observações.** Mantidas exatamente como na planilha (inclusive os números
   soltos, que são o final do cartão, e as marcações de parcela como
   `Franquia 1/3` ou `3/3 | 9441`). 493 registros não têm observação.

## O que *não* foi alterado

- Valores, saldos, clientes, tipos e datas válidas entraram sem nenhum ajuste —
  a soma de cada coluna no banco bate centavo a centavo com a planilha.
- `data_pagamento` ficou nula: a planilha não informa a data da baixa.
- `boleto_feito` ficou no padrão (`false`).
- **Repetições de placa + saída não foram removidas.** São 154 grupos
  (432 linhas) e representam parcelas do mesmo cartão (a mesma locação com
  vencimentos diferentes) ou cobranças distintas da mesma locação (Locação +
  Multas + Pedágio). Nenhuma linha da planilha é idêntica a outra em todas as
  12 colunas. Atenção: a importação pela tela do app marca essas linhas como
  duplicadas e as descarta — por isso esta carga é feita por SQL, e não pelo
  botão "Importar Excel".

## Como refazer a carga

Em banco novo, basta rodar `supabase/setup.sql` inteiro no SQL Editor.
Em banco já em uso, os scripts avulsos permitem rodar por partes — lembrando
que `seed.sql` começa com `truncate table public.lancamentos`.

A carga foi validada rodando `setup.sql` e a sequência avulsa
(`schema.sql` → `veiculos.sql` → `boleto_feito.sql` → `seed.sql`) num
PostgreSQL 16 local: os dois caminhos terminam com 753 lançamentos,
185 veículos e os mesmos totais da tabela acima.
