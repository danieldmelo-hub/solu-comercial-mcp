// SOLU Comercial — cliente Base44 + lógica de negócio.
// Sem dependências externas: usa fetch nativo (Node >= 18).
// Escopo: acesso FULL de leitura/escrita ao ERP (navega qualquer entidade).
// Guarda-corpo de segurança: NÃO expõe delete em nenhum lugar.

const APP_ID = process.env.BASE44_APP_ID || "690e523c4894b10373254ffc";
const API_KEY = process.env.BASE44_API_KEY || "";
const BASE = `https://app.base44.com/api/apps/${APP_ID}/entities`;

if (!API_KEY) {
  // Não derruba o processo aqui (o MCP pode subir e reportar no testar_conexao),
  // mas deixa claro no stderr.
  console.error(
    "[solu-comercial] AVISO: BASE44_API_KEY não configurada. Configure no env do MCP.",
  );
}

async function b44(method, path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      api_key: API_KEY,
      "Content-Type": "application/json",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Base44 ${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

async function getAll(entity, cap = 2000) {
  const out = [];
  let skip = 0;
  while (out.length < cap) {
    const page = await b44("GET", `${entity}?limit=500&skip=${skip}`);
    if (!page || page.length === 0) break;
    out.push(...page);
    if (page.length < 500) break;
    skip += 500;
  }
  return out;
}

const norm = (s) => (s || "").toString().trim().toLowerCase();
const digits = (s) => (s || "").toString().replace(/\D/g, "");
const nowISO = () => new Date().toISOString();

// ───────────────────────── Conexão ─────────────────────────
export async function testarConexao() {
  const leads = await b44("GET", "Lead?limit=1");
  return {
    ok: true,
    app_id: APP_ID,
    api_key_configurada: Boolean(API_KEY),
    exemplo_lead: leads?.[0]?.name ?? null,
  };
}

// ───────────────────────── Produtos ─────────────────────────
export async function listarProdutos({ product_type } = {}) {
  let prods = await getAll("Product");
  prods = prods.filter((p) => p.active !== false);
  if (product_type) prods = prods.filter((p) => p.product_type === product_type);
  return prods.map((p) => ({
    id: p.id,
    name: p.name,
    product_type: p.product_type,
    package_name: p.package_name,
    price_from: p.price_from,
    price_to: p.price_to,
    features: p.features,
  }));
}

// ───────────────────────── Leads ─────────────────────────
export async function buscarLeads({ termo, status, limite = 20 } = {}) {
  let leads = await getAll("Lead");
  if (termo) {
    const t = norm(termo);
    leads = leads.filter(
      (l) => norm(l.name).includes(t) || norm(l.phone).includes(t) || norm(l.neighborhood).includes(t),
    );
  }
  if (status) leads = leads.filter((l) => l.status === status || l.commercial_status === status);
  return leads.slice(0, limite).map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    neighborhood: l.neighborhood,
    product_type: l.product_type,
    status: l.status,
    commercial_status: l.commercial_status,
    proposal_value: l.proposal_value,
    total_value: l.total_value,
  }));
}

export async function criarLead(input) {
  // Anti-duplicacao: se ja existe lead com o mesmo telefone (so digitos) ou o
  // mesmo nome, nao cria um card duplicado — devolve o existente para o
  // assistente atualizar (atualizar_lead / adicionar_observacao_lead).
  const novoTel = digits(input.phone);
  const novoNome = norm(input.name);
  if (novoTel.length >= 8 || novoNome) {
    const existentes = await getAll("Lead");
    const dup = existentes.find((l) => {
      const telIgual = novoTel.length >= 8 && digits(l.phone) === novoTel;
      const nomeIgual = novoNome && norm(l.name) === novoNome;
      return telIgual || nomeIgual;
    });
    if (dup) {
      return {
        duplicate: true,
        message:
          `Ja existe um lead para "${dup.name}" (${dup.phone || "sem telefone"}). ` +
          `NAO criei card duplicado — use atualizar_lead / adicionar_observacao_lead no id abaixo.`,
        existing: {
          id: dup.id,
          name: dup.name,
          phone: dup.phone,
          neighborhood: dup.neighborhood,
          status: dup.status,
          commercial_status: dup.commercial_status,
        },
      };
    }
  }

  const body = {
    name: input.name,
    phone: input.phone,
    neighborhood: input.neighborhood,
    address: input.address,
    origin: input.origin,
    product_type: input.product_type,
    status: input.status || "novo",
    commercial_status: input.commercial_status,
    observations: input.observacao
      ? [{ text: input.observacao, created_at: nowISO(), created_by: input.vendedor || "MCP" }]
      : undefined,
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
  const created = await b44("POST", "Lead", body);
  return { duplicate: false, created };
}

export async function atualizarLead({ id, ...campos }) {
  if (!id) throw new Error("id do lead é obrigatório");
  const permitidos = [
    "name", "phone", "neighborhood", "address", "origin", "product_type",
    "status", "commercial_status", "proposal_value", "total_value",
    "proposal_sent_date", "expected_close_date", "construction_phase", "budget_expectation",
  ];
  const body = {};
  for (const k of permitidos) if (campos[k] !== undefined) body[k] = campos[k];
  if (Object.keys(body).length === 0) throw new Error("nenhum campo válido para atualizar");
  return b44("PUT", `Lead/${id}`, body);
}

export async function adicionarObservacaoLead({ id, texto, vendedor, tipo = "observacao" }) {
  if (!id || !texto) throw new Error("id e texto são obrigatórios");
  const lead = await b44("GET", `Lead/${id}`);
  const campo = tipo === "evolucao" ? "evolution" : "observations";
  const lista = Array.isArray(lead[campo]) ? lead[campo] : [];
  lista.push({ text: texto, created_at: nowISO(), created_by: vendedor || "MCP" });
  return b44("PUT", `Lead/${id}`, { [campo]: lista });
}

// ───────────────────────── Propostas ─────────────────────────
function calcProposta(input) {
  const products = (input.products || []).map((p) => {
    const quantity = Number(p.quantity ?? 1);
    const unit_price = Number(p.unit_price ?? 0);
    const total = p.total != null ? Number(p.total) : quantity * unit_price;
    return { name: p.name, quantity, unit_price, total };
  });
  const subtotal =
    input.subtotal != null ? Number(input.subtotal) : products.reduce((s, p) => s + (p.total || 0), 0);
  const discount = Number(input.discount || 0);
  const total_value = input.total_value != null ? Number(input.total_value) : subtotal - discount;
  return { products, subtotal, discount, total_value };
}

export async function criarProposta(input) {
  if (!input.client_name) throw new Error("client_name é obrigatório");
  const { products, subtotal, discount, total_value } = calcProposta(input);
  const body = {
    lead_id: input.lead_id,
    client_name: input.client_name,
    title: input.title || `Proposta — ${input.client_name}`,
    status: input.status || "rascunho",
    products,
    subtotal,
    discount,
    total_value,
    valid_until: input.valid_until,
    sent_date: input.status === "enviada" ? input.sent_date || nowISO().slice(0, 10) : input.sent_date,
    document_content: input.document_content,
    document_url: input.document_url,
    created_by: input.vendedor,
    version: input.version || 1,
    notes: input.notes,
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
  const prop = await b44("POST", "Proposal", body);
  // Reflete no Lead (pipeline comercial) se houver lead_id
  if (input.lead_id) {
    try {
      await b44("PUT", `Lead/${input.lead_id}`, {
        commercial_status: "orcamento",
        proposal_value: total_value,
        ...(body.sent_date ? { proposal_sent_date: body.sent_date } : {}),
      });
    } catch (e) {
      /* não bloqueia a criação da proposta se o lead falhar */
    }
  }
  return prop;
}

export async function atualizarProposta({ id, ...campos }) {
  if (!id) throw new Error("id da proposta é obrigatório");
  const permitidos = [
    "title", "status", "products", "subtotal", "discount", "total_value",
    "valid_until", "sent_date", "document_content", "document_url", "version", "notes",
  ];
  const body = {};
  for (const k of permitidos) if (campos[k] !== undefined) body[k] = campos[k];
  if (campos.products) {
    const c = calcProposta(campos);
    body.products = c.products;
    body.subtotal = campos.subtotal ?? c.subtotal;
    body.total_value = campos.total_value ?? c.total_value;
  }
  if (Object.keys(body).length === 0) throw new Error("nenhum campo válido para atualizar");
  return b44("PUT", `Proposal/${id}`, body);
}

export async function listarPropostas({ lead_id, client_name, limite = 20 } = {}) {
  let props = await getAll("Proposal");
  if (lead_id) props = props.filter((p) => p.lead_id === lead_id);
  if (client_name) props = props.filter((p) => norm(p.client_name).includes(norm(client_name)));
  return props
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
    .slice(0, limite);
}

// ───────────────────────── Contratos ─────────────────────────
export async function criarContrato(input) {
  if (!input.client_name) throw new Error("client_name é obrigatório");
  const body = {
    lead_id: input.lead_id,
    proposal_id: input.proposal_id,
    client_name: input.client_name,
    status: input.status || "rascunho",
    total_value: input.total_value,
    payment_terms: input.payment_terms,
    scope: input.scope,
    start_date: input.start_date,
    signed_date: input.status === "assinado" ? input.signed_date || nowISO().slice(0, 10) : input.signed_date,
    document_content: input.document_content,
    document_url: input.document_url,
    created_by: input.vendedor,
    notes: input.notes,
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);
  const contrato = await b44("POST", "Contract", body);
  if (input.lead_id && body.status === "assinado") {
    try {
      await b44("PUT", `Lead/${input.lead_id}`, { commercial_status: "ativo", status: "ganho", total_value: input.total_value });
    } catch (e) {
      /* não bloqueia */
    }
  }
  return contrato;
}

export async function atualizarContrato({ id, ...campos }) {
  if (!id) throw new Error("id do contrato é obrigatório");
  const permitidos = [
    "status", "total_value", "payment_terms", "scope",
    "start_date", "signed_date", "document_content", "document_url", "notes",
  ];
  const body = {};
  for (const k of permitidos) if (campos[k] !== undefined) body[k] = campos[k];
  if (Object.keys(body).length === 0) throw new Error("nenhum campo válido para atualizar");
  return b44("PUT", `Contract/${id}`, body);
}


// ───────────────────────── Acesso geral ao sistema ─────────────────────────
// Navegar/ler/gravar QUALQUER entidade do ERP. Sem delete (guarda-corpo).

// Entidades conhecidas (orientação; `consultar` aceita qualquer nome).
export const ENTIDADES = [
  "Lead", "Project", "Visit", "BackofficeItem", "BackofficeConfig",
  "Inventory", "Product", "Proposal", "Contract", "Task", "SupportTicket", "User",
];

export async function listarEntidades() {
  return {
    entidades: ENTIDADES,
    dica: "Use 'consultar' com o nome da entidade para ler os registros. Ex.: Project = Obras, Visit = Agenda, Task = POPs.",
  };
}

// Consulta genérica: lê a entidade, aplica filtro simples e ordenação, devolve os primeiros `limite`.
export async function consultar({ entidade, filtro, ordenar, limite = 50 } = {}) {
  if (!entidade) throw new Error("informe a entidade (ex.: Project, Visit, Inventory)");
  let recs = await getAll(entidade);
  if (filtro && typeof filtro === "object") {
    recs = recs.filter((r) =>
      Object.entries(filtro).every(([k, v]) => {
        const rv = r?.[k];
        if (typeof rv === "string" && typeof v === "string") return norm(rv).includes(norm(v));
        return rv === v;
      }),
    );
  }
  if (ordenar) {
    const desc = ordenar.startsWith("-");
    const key = desc ? ordenar.slice(1) : ordenar;
    recs = [...recs].sort((a, b) => {
      const av = a?.[key], bv = b?.[key];
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (desc ? -1 : 1);
    });
  }
  return { entidade, total_encontrado: recs.length, registros: recs.slice(0, limite) };
}

export async function obterRegistro({ entidade, id } = {}) {
  if (!entidade || !id) throw new Error("informe entidade e id");
  return b44("GET", `${entidade}/${id}`);
}

export async function criarRegistro({ entidade, dados } = {}) {
  if (!entidade) throw new Error("informe a entidade");
  if (!dados || typeof dados !== "object") throw new Error("informe os dados do registro");
  return b44("POST", entidade, dados);
}

export async function atualizarRegistro({ entidade, id, dados } = {}) {
  if (!entidade || !id) throw new Error("informe entidade e id");
  if (!dados || typeof dados !== "object") throw new Error("informe os dados a atualizar");
  return b44("PUT", `${entidade}/${id}`, dados);
}
