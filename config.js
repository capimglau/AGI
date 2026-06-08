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
  url: "",
  key: "",
  aiProxy: ""
};
