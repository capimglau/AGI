-- AutoGest Pro · migração: campo separado para a data do pagamento
-- Execute uma vez no SQL Editor do Supabase (projeto já em uso).
--
-- Antes, a baixa gravava a data do pagamento dentro do próprio campo `obs`
-- (texto "pago DD/MM/AA"), o que apagava qualquer referência já cadastrada
-- ali (ex. final do cartão). Agora a data vai para esta coluna separada, e o
-- `obs` deixa de ser tocado automaticamente pela baixa.

alter table public.lancamentos
  add column if not exists data_pagamento date;
