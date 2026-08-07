# Importação da planilha `rentabilidade_IA.xlsx`

Os arquivos `seed.sql`, `veiculos.sql` e `setup.sql` são **gerados** por
`supabase/gerar_seed.py` a partir da planilha `rentabilidade_IA.xlsx` (raiz do
repositório). Este documento registra a conferência da carga.

## Regra da carga

**Os valores entram idênticos aos da planilha.** `Valor`, `Valor Pago` e
`Saldo` são copiados célula a célula — nada é recalculado, arredondado ou
substituído, e célula vazia vira `NULL`, não zero. O gerador confere isso
linha a linha e **aborta sem escrever nada** se qualquer valor divergir.

As correções aplicadas ficam restritas a campos que não são valor (placa,
proprietário, forma de pagamento e datas). Estão listadas mais abaixo.

## Conferência (planilha × sistema)

|                | Planilha | Sistema | Bate? |
|----------------|---------:|--------:|:-----:|
| Lançamentos    | 753 | 753 | ✓ |
| Baixados       | 672 | 672 | ✓ |
| Pendentes      | 81 | 81 | ✓ |
| Faturado       | R$ 1.028.879,28 | R$ 1.028.879,28 | ✓ |
| Recebido       | R$ 888.984,35 | R$ 888.984,35 | ✓ |
| A receber      | R$ 136.365,10 | R$ 136.365,10 | ✓ |

Comparação linha a linha das 753 linhas (valor, valor pago, saldo, cliente,
tipo, placa e observação): **0 divergências**.

### Faturado por mês de vencimento

| Mês | Planilha | Sistema |
|-----|---------:|--------:|
| 01/2026 | 88 · R$ 124.987,39 | 88 · R$ 124.987,39 |
| 02/2026 | 99 · R$ 115.193,88 | 99 · R$ 115.193,88 |
| 03/2026 | 95 · R$ 112.340,60 | 95 · R$ 112.340,60 |
| 04/2026 | 114 · R$ 139.204,98 | 114 · R$ 139.204,98 |
| 05/2026 | 98 · R$ 123.516,63 | 98 · R$ 123.516,63 |
| 06/2026 | 84 · R$ 123.601,31 | 84 · R$ 123.601,31 |
| 07/2026 | 82 · R$ 134.643,02 | 82 · R$ 134.643,02 |
| 08/2026 | 68 · R$ 118.823,24 | 68 · R$ 118.823,24 |
| 09/2026 | 18 · R$ 32.410,49 | 18 · R$ 32.410,49 |
| 10/2026 | 5 · R$ 3.125,11 | 5 · R$ 3.125,11 |
| 11/2026 | 2 · R$ 1.032,63 | 2 · R$ 1.032,63 |

Nenhuma correção de vencimento atravessa a virada do mês, então o total de
cada mês fica igual ao da planilha. Todo o pendente é de agosto/2026 em
diante — de janeiro a julho a planilha traz tudo quitado.

### Faturado por proprietário

| Proprietário | Planilha | Sistema |
|--------------|---------:|--------:|
| Silvio | R$ 837.559,45 | R$ 837.559,45 |
| Eliana | R$ 54.120,74 | R$ 54.120,74 |
| Leandro | R$ 42.068,90 | R$ 42.068,90 |
| Arnaldo | R$ 35.271,79 | R$ 35.271,79 |
| Lorenzo | R$ 22.539,14 | R$ 22.539,14 |
| Silvio 2 | R$ 17.737,05 | R$ 17.737,05 |
| Lucélia | R$ 10.350,31 | **R$ 19.582,21** |
| *(em branco)* | R$ 9.231,90 | — |

Única diferença de subtotal, e ela vem da correção nº 2 abaixo: os
R$ 9.231,90 que na planilha estão sem proprietário passam para a Lucélia,
dona do carro. O total geral não muda.

## Correções aplicadas

Nenhuma delas altera valor.

1. **Placa em maiúsculas e sem espaços.** A planilha grafa o mesmo carro de
   várias formas (`SVMle`/`SVMLe`/`SVMLE`, `FKGs`/`FKGS`, `SVV5f23`,
   `SWV1j01`, `TKAs`, `SIl0000`). Normalizando, as 66 grafias viram as **60
   placas reais**, todas casando com a frota e com o `PLACA_DONO` do app.
   Não foi inserido hífen (o resto do sistema usa a placa sem hífen).

2. **Dono em branco.** 9 lançamentos da placa `UDO2F61` estão sem
   proprietário na planilha. Foram completados pela frota, que registra o
   carro como da **Lucélia** — mesma informação em `veiculos.sql` e no
   `PLACA_DONO` do `index.html`. Sem correspondência na frota o dono viraria
   `Indefinido`, o que não ocorreu em nenhum registro.

3. **Forma de pagamento.** `Crédito 90 dias` → **`Crédito 3x`** (149) e
   `Crédito 60 dias` → **`Crédito 2x`** (8). Mesmo parcelamento e mesma taxa
   (`getTaxaForma`), mas com o rótulo que os formulários do app usam. As
   demais entraram como estão: Boleto (460), Crédito (85), Depósito (32),
   Débito (17), Dinheiro (2).

4. **Datas digitadas errado.** Quatro células não eram datas válidas:

   | Linha | Campo | Planilha | Gravado | Por quê |
   |-------|-------|----------|---------|---------|
   | 57 | Retorno | `10/1/026` | `2026-01-10` | ano digitado com um zero a mais |
   | 318 | Saída | `8u24/3` | `2026-03-24` | tecla presa; 24/03 + 30 dias = 23/04, que é o retorno |
   | 633 | Saída | `14/6.` | `2026-06-14` | ponto sobrando |
   | 388 | Saída e Retorno | `multa` | `NULL` | não é data — é um lançamento do tipo Multas |

   A linha 670 (também Multas) já vinha sem saída e sem retorno. Ao todo
   **2 registros sem data de saída**, ambos de multa. Nenhum ficou sem
   `prev_pgto`. Texto de data fora dessa tabela derruba a geração de
   propósito, para nada entrar adivinhado.

5. **Vencimento em fim de semana.** 35 pendentes venciam sábado ou domingo e
   passaram para a segunda seguinte. É a mesma correção que o app aplica
   sozinho ao carregar (`proxUtil` / `fixWeekendVencimentos`); fazer aqui
   evita uma rajada de updates no primeiro acesso. Registros já quitados
   ficaram com a data original da planilha.

## O que não foi alterado

- Valores, saldos, valor pago, clientes, tipos, observações e datas válidas.
- `Valor Pago` em branco ficou **`NULL`** (não zero), como na planilha — são
  exatamente os 81 registros com saldo em aberto. Na tela aparecem como "—".
- `data_pagamento` ficou nula: a planilha não informa a data da baixa.
- `boleto_feito` ficou no padrão (`false`).
- **Repetições de placa + saída não foram removidas.** São 154 grupos
  (432 linhas) e representam parcelas do mesmo cartão (a mesma locação com
  vencimentos diferentes) ou cobranças distintas da mesma locação (Locação +
  Multas + Pedágio). Nenhuma linha da planilha é idêntica a outra nas 12
  colunas. Atenção: a importação pela tela do app marca essas linhas como
  duplicadas e as descarta — por isso esta carga é feita por SQL, e não pelo
  botão "Importar Excel".

## Como refazer a carga

Em banco novo, rode `supabase/setup.sql` inteiro no SQL Editor. Em banco já
em uso, os scripts avulsos permitem rodar por partes — lembrando que
`seed.sql` começa com `truncate table public.lancamentos`.

Para regerar os SQL depois de mexer na planilha:

```bash
pip install openpyxl
python3 supabase/gerar_seed.py
```

O script imprime todas as correções que aplicou e confere os valores contra a
planilha antes de escrever.

A carga foi validada rodando `setup.sql` e a sequência avulsa
(`schema.sql` → `veiculos.sql` → `boleto_feito.sql` → `seed.sql`) num
PostgreSQL 16 local: os dois caminhos terminam com 753 lançamentos,
185 veículos e os números da tabela de conferência acima.
