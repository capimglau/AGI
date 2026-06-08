# AutoGest Pro

Sistema de gestão de locação de veículos (controle de lançamentos, baixas,
proprietários, resumos e premissas de taxas). App web de página única, com os
dados persistidos no **Supabase** e publicado no **GitHub Pages**.

## Como está montado

| Camada     | Tecnologia                                            |
|------------|-------------------------------------------------------|
| Front-end  | `index.html` (HTML/CSS/JS puro + Chart.js)            |
| Banco      | Supabase (Postgres) — tabela `lancamentos`            |
| Deploy     | GitHub Pages (workflow em `.github/workflows`)        |
| IA (opc.)  | Edge Function `supabase/functions/ai-contrato`        |

Sem configurar o Supabase, o app abre em **modo demo** (dados de exemplo
embutidos, em memória, sem salvar). Configurando o `config.js`, ele passa a
ler e gravar de verdade.

---

## Passo 1 — Criar o banco no Supabase

1. Crie um projeto em https://supabase.com.
2. Abra **SQL Editor** e rode, nesta ordem:
   - `supabase/schema.sql` (cria a tabela `lancamentos` e as políticas)
   - `supabase/seed.sql` (carrega os 597 lançamentos iniciais)
3. Em **Project Settings → API**, copie:
   - **Project URL**
   - chave **anon public**

## Passo 2 — Conectar o app

Edite o arquivo `config.js` na raiz do repositório:

```js
window.AUTOGEST_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  key: "SUA_CHAVE_ANON_PUBLIC",
  aiProxy: ""   // opcional, ver Passo 4
};
```

> A chave `anon` é pública por natureza — pode ficar no repositório. A proteção
> dos dados vem da Row Level Security (RLS) do Supabase, não do segredo da chave.

## Passo 3 — Publicar no GitHub Pages

O workflow `.github/workflows/deploy.yml` publica automaticamente a cada push.
Basta habilitar o Pages uma vez:

1. No GitHub: **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. O site sai em `https://<usuario>.github.io/agi/` após o workflow concluir.

(Alternativa sem Actions: em **Settings → Pages → Source**, escolher
"Deploy from a branch" e apontar para a branch/raiz que contém o `index.html`.)

## Passo 4 — Leitura de contrato por foto (opcional)

A função "📷 Ler contrato com IA" usa a API da Anthropic. Para funcionar no
navegador sem expor a chave, faça deploy da Edge Function:

```bash
supabase functions deploy ai-contrato
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

E aponte o `config.js`:

```js
aiProxy: "https://SEU-PROJETO.supabase.co/functions/v1/ai-contrato"
```

---

## Segurança

A política RLS incluída libera leitura/escrita para a chave **anônima** — ótimo
para colocar no ar rápido, mas significa que qualquer um com a URL do site pode
ver/editar os dados. Para uso real, ative o **Supabase Auth** e restrinja as
políticas em `schema.sql` para usuários autenticados.

## Estrutura

```
index.html                          App (front-end)
config.js                           Credenciais do Supabase (edite aqui)
supabase/schema.sql                 Cria a tabela e as políticas
supabase/seed.sql                   Carrega os 597 lançamentos iniciais
supabase/functions/ai-contrato/     Edge Function opcional (IA por foto)
.github/workflows/deploy.yml        Publicação automática no GitHub Pages
```
