# SOLU Comercial — MCP

MCP local que conecta o **Claude Code** de cada vendedor ao **ERP da SOLU (Base44)**.
Enquanto o vendedor trabalha (qualifica um lead, redige uma proposta, fecha um contrato),
o Claude Code grava tudo direto no sistema — **Leads, Propostas e Contratos**.

```
Claude Code (vendedor)  →  MCP SOLU Comercial  →  API Base44  →  ERP (Leads / Propostas / Contratos)
```

## Ferramentas disponíveis (11)

| Área | Ferramenta | O que faz |
|---|---|---|
| Setup | `testar_conexao` | Confirma que está conectado ao ERP |
| Produtos | `listar_produtos` | Lista pacotes com preços reais (pra montar propostas) |
| Leads | `buscar_leads` | Acha lead por nome/telefone/bairro/status |
| Leads | `criar_lead` | Cria um novo lead |
| Leads | `atualizar_lead` | Move no pipeline, registra valores |
| Leads | `adicionar_observacao_lead` | Registra observação/evolução (com histórico) |
| Propostas | `criar_proposta` | Cria proposta (produtos, valores, documento) e move o lead p/ "proposta" |
| Propostas | `atualizar_proposta` | Muda status/itens/documento |
| Propostas | `listar_propostas` | Lista propostas de um lead/cliente |
| Contratos | `criar_contrato` | Cria contrato; se "assinado", marca o lead como venda/ganho |
| Contratos | `atualizar_contrato` | Muda status/valores/documento |

> **Segurança:** o MCP **só lê, cria e atualiza** Leads, Propostas, Contratos e Produtos.
> Não apaga nada e não toca no resto do sistema. É um caminho seguro por design.

## Instalação (uma vez por Mac)

**Pré-requisito:** Node.js 18+ (`node -v`). Se não tiver: https://nodejs.org

### Opção A — via `npx` (recomendado, NÃO precisa baixar pasta) ⭐

Um comando só. O `npx` baixa o MCP do GitHub sozinho e mantém atualizado.
Peça a chave do comercial ao Daniel e troque em `SUA_CHAVE`:

```bash
claude mcp add solu-comercial --scope user \
  --env BASE44_API_KEY=SUA_CHAVE \
  -- npx -y github:danieldmelo-hub/solu-comercial-mcp
```

> `--scope user` deixa o MCP disponível em **todos** os seus projetos do Claude Code.
> Quando o Daniel atualizar o código (git push), sua próxima sessão já pega a versão nova.

### Opção B — baixando a pasta (offline / sem GitHub)

1. **Copie a pasta `solu-comercial-mcp`** para o seu Mac (ex.: `~/solu-comercial-mcp`).
2. Instale as dependências:
   ```bash
   cd ~/solu-comercial-mcp
   npm install
   ```
3. **Conecte ao Claude Code:**
   ```bash
   claude mcp add solu-comercial --scope user \
     --env BASE44_API_KEY=SUA_CHAVE \
     -- node ~/solu-comercial-mcp/index.js
   ```

### Teste (qualquer opção)
Abra o Claude Code e peça *"testa a conexão do SOLU Comercial"*. Deve responder `ok: true`.

### Alternativa: configurar por arquivo
Em vez do passo 3, dá pra editar `~/.claude.json` (ou o `.mcp.json` do projeto):
```json
{
  "mcpServers": {
    "solu-comercial": {
      "command": "node",
      "args": ["/Users/SEU_USUARIO_MAC/solu-comercial-mcp/index.js"],
      "env": {
        "BASE44_API_KEY": "SUA_CHAVE",
        "BASE44_APP_ID": "690e523c4894b10373254ffc"
      }
    }
  }
}
```

## Como usar no dia a dia

É só conversar normalmente com o Claude Code — ele decide quando chamar as ferramentas. Exemplos:

- *"Cria um lead: João Silva, (61) 99999-0000, Lago Sul, veio pelo Instagram, interesse em automação."*
- *"Monta uma proposta de som ambiente pra Marina no Sudoeste: 6 zonas + subwoofer. Puxa os preços dos produtos, aplica 5% de desconto e salva no sistema."*
- *"Atualiza o lead do Gustavo pra 'proposta enviada' e registra o valor de R$ 45.000."*
- *"Gera o contrato da proposta aprovada da Marina, 50% entrada + 50% na entrega, e marca como assinado."*

### Dica: deixe o Claude Code registrar tudo sozinho
No projeto que os vendedores usam, coloque um `CLAUDE.md` com algo assim:

```md
Você é o assistente comercial da SOLU. Use o MCP "solu-comercial" para refletir
TUDO no ERP: ao criar/qualificar um lead, gerar proposta ou fechar contrato,
grave no sistema (criar_lead, criar_proposta, criar_contrato, atualizar_*).
Sempre puxe preços reais com listar_produtos. Ao gerar o texto da proposta/contrato,
salve o markdown no campo document_content. Assine as ações com o nome do vendedor.
```

## Suporte / manutenção
- Precisa de mais campos ou uma nova ferramenta? É só editar `lib.js` (lógica) e `index.js` (ferramenta).
- A chave de API deve ser **dedicada do comercial** (não a de admin). Peça ao Daniel.
