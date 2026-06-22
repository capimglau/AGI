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
  url: "https://niagjkpjvdkmryhkugbg.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pYWdqa3BqdmRrbXJ5aGt1Z2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTU1MTYsImV4cCI6MjA5NjUzMTUxNn0._uL2KkA4riJPC6oCpa21ahsmJMAKf8lnPdYPepnykik",
  aiProxy: "https://niagjkpjvdkmryhkugbg.supabase.co/functions/v1/ai-contrato"
};
