// ─────────────────────────────────────────────────────────────
//  AutoGest Pro · configuração de conexão
// ─────────────────────────────────────────────────────────────
//  Preencha com os dados do seu projeto Supabase.
//  (Project Settings → API)
//
//  - url : "Project URL"      ex: https://xxxxxxxx.supabase.co
//  - key : "anon public" key  (pode ficar pública; é protegida por RLS)
//
//  Enquanto estiver vazio, o app roda em MODO DEMO (dados em memória,
//  sem salvar nada). Assim que preencher, ele lê e grava no Supabase.
//
//  aiProxy (opcional): URL de uma Edge Function que repassa a leitura
//  de contrato por foto para a API da Anthropic. Veja supabase/functions.
// ─────────────────────────────────────────────────────────────
window.AUTOGEST_CONFIG = {
  url: "https://gymvzfwbkteleyzdpcyl.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5bXZ6Zndia3RlbGV5emRwY3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMDA5OTcsImV4cCI6MjEwMDU3Njk5N30.FwfWCo36bmk8BvHO7dMAW3zYzTsTl7LAXbKpaU-p3j0",
  aiProxy: ""
};
