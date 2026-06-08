// AutoGest Pro · Edge Function (opcional)
// Repassa a leitura de contrato por foto para a API da Anthropic,
// mantendo a ANTHROPIC_API_KEY em segredo no servidor (não exposta no navegador).
//
// Deploy:
//   supabase functions deploy ai-contrato
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Depois, em config.js, defina:
//   aiProxy: "https://SEU-PROJETO.supabase.co/functions/v1/ai-contrato"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.text();
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body,
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "content-type": "application/json" },
    });
  }
});
