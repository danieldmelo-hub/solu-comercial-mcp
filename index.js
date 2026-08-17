#!/usr/bin/env node
// SOLU Comercial — servidor MCP (stdio) para o Claude Code do time comercial.
// Expõe ferramentas seguras que gravam Leads, Propostas e Contratos no ERP (Base44).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as solu from "./lib.js";

const server = new McpServer({ name: "solu-comercial", version: "1.0.0" });

// helper: padroniza retorno em texto (JSON legível) e trata erros
const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const wrap = (fn) => async (args) => {
  try {
    return ok(await fn(args));
  } catch (e) {
    return { content: [{ type: "text", text: `❌ Erro: ${e.message}` }], isError: true };
  }
};

const produtoSchema = z.object({
  name: z.string(),
  quantity: z.number().optional(),
  unit_price: z.number().optional(),
  total: z.number().optional(),
});

// ── Conexão ──
server.tool(
  "testar_conexao",
  "Verifica se o MCP está conectado ao ERP SOLU (Base44). Use no primeiro uso para confirmar o setup.",
  {},
  wrap(() => solu.testarConexao()),
);

// ── Produtos (para precificar propostas) ──
server.tool(
  "listar_produtos",
  "Lista os produtos/pacotes ativos da SOLU com faixas de preço. Use para montar propostas com preços reais.",
  { product_type: z.enum(["som_ambiente", "painel_led", "flap_tv", "automacao_residencial", "home_theater"]).optional() },
  wrap((a) => solu.listarProdutos(a)),
);

// ── Leads ──
server.tool(
  "buscar_leads",
  "Busca leads no ERP por nome/telefone/bairro e/ou status. Use para achar o lead antes de atualizar ou criar proposta.",
  {
    termo: z.string().optional().describe("Nome, telefone ou bairro para buscar"),
    status: z.string().optional().describe("Filtra por status ou status comercial"),
    limite: z.number().optional(),
  },
  wrap((a) => solu.buscarLeads(a)),
);

server.tool(
  "criar_lead",
  "Cria um novo lead no ERP.",
  {
    name: z.string().describe("Nome do cliente"),
    phone: z.string().optional(),
    neighborhood: z.string().optional().describe("Bairro/região"),
    address: z.string().optional(),
    origin: z.string().optional().describe("De onde veio (Instagram, Indicação, Site...)"),
    product_type: z.enum(["som_ambiente", "painel_led", "flap_tv", "automacao_residencial", "home_theater"]).optional(),
    status: z.string().optional(),
    commercial_status: z.string().optional(),
    observacao: z.string().optional().describe("Primeira observação/anotação"),
    vendedor: z.string().optional(),
  },
  wrap((a) => solu.criarLead(a)),
);

server.tool(
  "atualizar_lead",
  "Atualiza campos de um lead (ex.: mover no pipeline comercial, registrar valor de proposta). Requer o id do lead.",
  {
    id: z.string().describe("ID do lead"),
    status: z.enum(["novo", "contatado", "qualificado", "proposta_enviada", "negociacao", "ganho", "perdido"]).optional(),
    commercial_status: z.enum(["novo", "proposta", "revisao", "enviado", "reuniao_showroom", "venda", "financeiro", "concluido", "perdido"]).optional(),
    proposal_value: z.number().optional(),
    total_value: z.number().optional(),
    proposal_sent_date: z.string().optional(),
    expected_close_date: z.string().optional(),
    product_type: z.string().optional(),
    neighborhood: z.string().optional(),
    phone: z.string().optional(),
  },
  wrap((a) => solu.atualizarLead(a)),
);

server.tool(
  "adicionar_observacao_lead",
  "Adiciona uma observação (ou ponto de evolução do pipeline) a um lead, mantendo o histórico.",
  {
    id: z.string().describe("ID do lead"),
    texto: z.string(),
    tipo: z.enum(["observacao", "evolucao"]).optional().describe("'observacao' (geral) ou 'evolucao' (decisões/acordos do pipeline)"),
    vendedor: z.string().optional(),
  },
  wrap((a) => solu.adicionarObservacaoLead(a)),
);

// ── Propostas ──
server.tool(
  "criar_proposta",
  "Cria uma proposta no ERP (com produtos, valores e o documento gerado em markdown). Se informar lead_id, move o lead para 'proposta' no pipeline automaticamente.",
  {
    client_name: z.string(),
    lead_id: z.string().optional(),
    title: z.string().optional(),
    status: z.enum(["rascunho", "enviada", "em_revisao", "aprovada", "recusada", "expirada"]).optional(),
    products: z.array(produtoSchema).optional().describe("Itens da proposta (total é calculado se não vier)"),
    subtotal: z.number().optional(),
    discount: z.number().optional(),
    total_value: z.number().optional(),
    valid_until: z.string().optional().describe("Validade (YYYY-MM-DD)"),
    sent_date: z.string().optional(),
    document_content: z.string().optional().describe("Texto/markdown completo da proposta gerada"),
    document_url: z.string().optional(),
    vendedor: z.string().optional(),
    notes: z.string().optional(),
  },
  wrap((a) => solu.criarProposta(a)),
);

server.tool(
  "atualizar_proposta",
  "Atualiza uma proposta existente (status, itens, documento). Requer o id da proposta.",
  {
    id: z.string(),
    status: z.enum(["rascunho", "enviada", "em_revisao", "aprovada", "recusada", "expirada"]).optional(),
    title: z.string().optional(),
    products: z.array(produtoSchema).optional(),
    subtotal: z.number().optional(),
    discount: z.number().optional(),
    total_value: z.number().optional(),
    valid_until: z.string().optional(),
    sent_date: z.string().optional(),
    document_content: z.string().optional(),
    document_url: z.string().optional(),
    version: z.number().optional(),
    notes: z.string().optional(),
  },
  wrap((a) => solu.atualizarProposta(a)),
);

server.tool(
  "listar_propostas",
  "Lista propostas de um lead ou cliente (mais recentes primeiro).",
  {
    lead_id: z.string().optional(),
    client_name: z.string().optional(),
    limite: z.number().optional(),
  },
  wrap((a) => solu.listarPropostas(a)),
);

// ── Contratos ──
server.tool(
  "criar_contrato",
  "Cria um contrato no ERP (a partir de uma proposta ou avulso). Se status='assinado' e houver lead_id, marca o lead como 'venda/ganho'.",
  {
    client_name: z.string(),
    lead_id: z.string().optional(),
    proposal_id: z.string().optional(),
    status: z.enum(["rascunho", "enviado", "assinado", "cancelado"]).optional(),
    total_value: z.number().optional(),
    payment_terms: z.string().optional().describe("Condições de pagamento"),
    scope: z.string().optional().describe("Escopo/objeto do contrato"),
    start_date: z.string().optional(),
    signed_date: z.string().optional(),
    document_content: z.string().optional().describe("Texto/markdown completo do contrato"),
    document_url: z.string().optional(),
    vendedor: z.string().optional(),
    notes: z.string().optional(),
  },
  wrap((a) => solu.criarContrato(a)),
);

server.tool(
  "atualizar_contrato",
  "Atualiza um contrato existente (status, valores, documento). Requer o id do contrato.",
  {
    id: z.string(),
    status: z.enum(["rascunho", "enviado", "assinado", "cancelado"]).optional(),
    total_value: z.number().optional(),
    payment_terms: z.string().optional(),
    scope: z.string().optional(),
    start_date: z.string().optional(),
    signed_date: z.string().optional(),
    document_content: z.string().optional(),
    document_url: z.string().optional(),
    notes: z.string().optional(),
  },
  wrap((a) => solu.atualizarContrato(a)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[solu-comercial] MCP no ar (stdio).");
