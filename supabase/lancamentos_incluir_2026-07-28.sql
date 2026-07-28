-- AutoGest Pro · inclusão de novos lançamentos (18 registros)
-- Execute no SQL Editor do Supabase, após schema.sql já estar aplicado.
-- Este script apenas INSERE (não faz truncate da tabela).

insert into public.lancamentos (placa, dono, saida, retorno, cliente, tipo, valor, forma, prev_pgto, valor_pago, saldo, obs) values
  ('SVA9G97', 'Silvio', '2026-07-28', '2026-08-27', 'CD Mantem', 'Locação', 2409.6, 'Boleto', '2026-09-08', NULL, 2409.6, NULL),
  ('UFR2H17', 'Arnaldo', '2026-07-07', '2026-08-20', 'Ricardo de Campos', 'Locação', 951.84, 'Crédito 90 dias', '2026-08-27', NULL, 925.57, '8753'),
  ('UFR2H17', 'Arnaldo', '2026-07-07', '2026-08-20', 'Ricardo de Campos', 'Locação', 951.84, 'Crédito 90 dias', '2026-09-27', NULL, 925.57, '8753'),
  ('UFR2H17', 'Arnaldo', '2026-07-07', '2026-08-20', 'Ricardo de Campos', 'Locação', 951.84, 'Crédito 90 dias', '2026-10-27', NULL, 925.57, '8753'),
  ('UEG3D32', 'Silvio', '2026-07-27', '2026-07-31', 'Infra-Labor', 'Locação', 593.47, 'Boleto', '2026-08-08', NULL, 593.47, NULL),
  ('UEG3D32', 'Silvio', '2026-07-24', '2026-07-27', 'Alessandro Dardin', 'Locação', 148.35, 'Crédito 90 dias', '2026-08-24', NULL, 144.26, '7308'),
  ('UEG3D32', 'Silvio', '2026-07-24', '2026-07-27', 'Alessandro Dardin', 'Locação', 148.35, 'Crédito 90 dias', '2026-09-24', NULL, 144.26, '7308'),
  ('UEG3D32', 'Silvio', '2026-07-24', '2026-07-27', 'Alessandro Dardin', 'Locação', 148.35, 'Crédito 90 dias', '2026-10-24', NULL, 144.26, '7308'),
  ('SVT6C02', 'Silvio', '2026-07-24', '2026-08-23', 'Leopoldo Favrin', 'Locação', 2579.6, 'Crédito', '2026-08-27', NULL, 2517.69, '9303'),
  ('TKE2F18', 'Eliana', '2026-07-25', '2026-08-25', 'DB Construcoes', 'Locação', 2409.6, 'Boleto', '2026-08-26', NULL, 2409.6, NULL),
  ('SWV1J01', 'Silvio', '2026-06-23', '2026-07-23', 'Carlos Henrique', 'Locação', 2315.0, 'Crédito', '2026-08-02', NULL, 2259.44, '5208'),
  ('FCE1F62', 'Silvio', '2026-07-24', '2026-08-24', 'Consorcio CTF', 'Locação', 3516.55, 'Boleto', '2026-08-25', NULL, 3516.55, NULL),
  ('UQS1I95', 'Silvio', '2026-07-23', '2026-08-05', 'Leonardo Johnson', 'Locação', 1767.08, 'Crédito', '2026-08-23', NULL, 1724.67, '815'),
  ('UQS1I95', 'Silvio', '2026-07-23', '2026-08-05', 'Leonardo Johnson', 'Taxa Mario', 330.0, 'Crédito', '2026-08-23', NULL, 322.08, '815'),
  ('UQS1I95', 'Silvio', '2026-07-23', '2026-08-05', 'Leonardo Johnson', 'Lavagem', 30.0, 'Crédito', '2026-08-23', NULL, 29.28, '815'),
  ('SVT5H94', 'Silvio', '2026-08-21', '2026-09-20', 'Valeria Pinto', 'Locação', 2386.0, 'Boleto', '2026-08-11', NULL, 2386.0, NULL),
  ('UES3H77', 'Silvio', '2026-07-10', '2026-08-09', 'Sisvetor', 'Locação', 2408.0, 'Boleto', '2026-08-15', NULL, 2408.0, NULL),
  ('UES3H77', 'Silvio', '2026-07-10', '2026-08-09', 'Sisvetor', 'Taxa Alfredo', 50.0, 'Boleto', '2026-08-15', NULL, 50.0, NULL);
