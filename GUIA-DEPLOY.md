# SOLU Comercial — Guia para colocar no ar (100%)

MCP que faz o Claude Code de cada vendedor gravar **Leads, Propostas e Contratos**
direto no ERP da SOLU (Base44). Escopo seguro: só **lê, cria e atualiza** — não apaga nada.

---

## PARTE 1 — Publicar o código no GitHub (Daniel faz UMA vez)

1. Crie um repositório vazio em https://github.com/new
   - Name: `solu-comercial-mcp`
   - **Public** (recomendado — assim o `npx` instala sem login; não há segredo no código)
   - NÃO marque "Add README/.gitignore/license" (tem que nascer vazio)

2. Envie o código (troque SEU_USUARIO):
   ```bash
   cd /Users/danielmelo/Desktop/CLAUDE/solu-comercial-mcp
   git remote add origin https://github.com/SEU_USUARIO/solu-comercial-mcp.git
   git push -u origin main
   ```

Pronto — o código está no ar. Toda vez que você atualizar (git push), os vendedores
pegam a versão nova na próxima sessão.

---

## PARTE 2 — A chave de API do Base44

- O MCP lê a chave do ambiente (`BASE44_API_KEY`) — ela NUNCA vai pro GitHub.
- Pode usar a chave geral do projeto (o MCP não tem nenhuma função de apagar).
- Recomendado: criar uma chave dedicada do comercial no Base44 e distribuir essa.
- Você passa a chave para cada vendedor de forma privada (WhatsApp/1Password).

---

## PARTE 3 — Cada vendedor instala (UMA vez por Mac)

Pré-requisitos: Node.js 18+ (`node -v`) e Claude Code instalado.

Um comando só (troque SEU_USUARIO e A_CHAVE):
```bash
claude mcp add solu-comercial --scope user \
  --env BASE44_API_KEY=A_CHAVE \
  -- npx -y github:SEU_USUARIO/solu-comercial-mcp
```

Teste: abra o Claude Code e peça *"testa a conexão do SOLU Comercial"* → deve responder `ok: true`.

> Sem GitHub? Use o zip (Opção B do README.md): descompacta, `npm install`, e
> `claude mcp add ... -- node ~/solu-comercial-mcp/index.js`.

---

## PARTE 4 — Fazer o Claude Code do vendedor registrar tudo sozinho

Na pasta que o vendedor usa no Claude Code, crie um arquivo `CLAUDE.md` com:

```md
Você é o assistente comercial da SOLU. Use SEMPRE o MCP "solu-comercial" para
refletir tudo no ERP: ao qualificar um lead, gerar proposta ou fechar contrato,
grave no sistema (criar_lead, criar_proposta, criar_contrato, atualizar_*).
Puxe preços reais com listar_produtos. Salve o texto da proposta/contrato em
document_content. Assine as ações com o nome do vendedor.
```

---

## PARTE 5 — Uso no dia a dia (exemplos)

- "Cria um lead: João Silva, (61) 99999-0000, Lago Sul, veio pelo Instagram, quer automação."
- "Monta uma proposta de som ambiente pra Marina, 6 zonas, 5% de desconto, e salva."
- "Atualiza o lead do Gustavo pra 'proposta enviada' com valor de R$ 45.000."
- "Gera o contrato da proposta aprovada da Marina, 50% entrada + 50% na entrega."

## Ferramentas (11, escopo seguro — sem delete)
testar_conexao · listar_produtos · buscar_leads · criar_lead · atualizar_lead ·
adicionar_observacao_lead · criar_proposta · atualizar_proposta · listar_propostas ·
criar_contrato · atualizar_contrato
