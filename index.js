process.on("unhandledRejection", (err) => {
  console.log("⚠️ unhandledRejection:", err?.message || err);
});
process.on("uncaughtException", (err) => {
  console.log("⚠️ uncaughtException:", err?.message || err);
});

const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

// ======= VARIÁVEIS GLOBAIS =======
const lastVariantByTheme = new Map();
const lastGlobalThemeAt = new Map();
const lastUserThemeAt = new Map();

// ======= TEMPOS =======
const DELETE_WARNING_AFTER_MS = 4000;
const DELETE_NORMATIVE_AFTER_MS = 40000;
const GLOBAL_THEME_COOLDOWN_MS = 40000;
const USER_THEME_COOLDOWN_MS = 180000;

// ======= UTIL =======
function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLink(textNorm) {
  const linkRegex = /(https?:\/\/|www\.|chat\.whatsapp\.com\/|wa\.me\/|bit\.ly\/|tinyurl\.com\/|t\.co\/|\.com\b|\.net\b|\.org\b|\.br\b|\.io\b)/i;
  return linkRegex.test(textNorm);
}

function monospaceBlock(text) {
  const footer = "\n\n(esta mensagem se auto exclui)";
  return "```text\n" + (text.trim() + footer) + "\n```";
}

function pickDifferent(arr, last) {
  if (!arr.length) return null;
  if (arr.length === 1) return arr[0];
  
  if (!last) return arr[Math.floor(Math.random() * arr.length)];
  
  const lastIndex = arr.findIndex(item => item === last);
  if (lastIndex === -1) return arr[Math.floor(Math.random() * arr.length)];
  
  let attempts = 0;
  while (attempts < 10) {
    const newIndex = Math.floor(Math.random() * arr.length);
    if (newIndex !== lastIndex) return arr[newIndex];
    attempts++;
  }
  
  return arr[Math.floor(Math.random() * arr.length)];
}

// ======= FRASES =======
const PROHIBITED_WARNINGS = [
  "🚫 Proibido esse tipo de postagem.",
  "⚠️ Proibido esse tipo de postagem.",
  "🚫 Esse tipo de postagem é proibido aqui.",
  "⛔ Postagem não permitida no grupo.",
];

const HELP_LINES = [
  "👉 Aqui no grupo temos pessoas qualificadas para ajudar com esse processo.",
  "✅ Se precisar, no grupo há pessoas capacitadas para orientar e ajudar.",
  "📌 Aqui no grupo existem pessoas qualificadas para apoiar nessa demanda.",
  "🤝 No grupo há gente qualificada que pode ajudar com esse assunto.",
];

const CTB_LEADERS = [
  "📄 Segundo o Código de Trânsito Brasileiro (CTB), para esse caso é exigido:",
  "📄 Nos termos do CTB, para esse caso é exigido:",
  "📄 De acordo com o CTB, para esse procedimento é exigido:",
  "📄 Conforme o CTB, para esse caso é exigido:",
];

let lastHelpLine = null;
let lastCTBLeader = null;
let lastWarn = null;

function helpLine() {
  lastHelpLine = pickDifferent(HELP_LINES, lastHelpLine);
  return lastHelpLine;
}

function ctbLead() {
  lastCTBLeader = pickDifferent(CTB_LEADERS, lastCTBLeader);
  return lastCTBLeader;
}

function warnLine() {
  lastWarn = pickDifferent(PROHIBITED_WARNINGS, lastWarn);
  return lastWarn;
}

// ======= RATE LIMIT =======
function canRespond(themeKey, userId) {
  const t = Date.now();
  const g = lastGlobalThemeAt.get(themeKey) || 0;
  if (t - g < GLOBAL_THEME_COOLDOWN_MS) return false;

  let uMap = lastUserThemeAt.get(userId);
  if (!uMap) {
    uMap = new Map();
    lastUserThemeAt.set(userId, uMap);
  }
  const u = uMap.get(themeKey) || 0;
  if (t - u < USER_THEME_COOLDOWN_MS) return false;

  return true;
}

function markResponded(themeKey, userId) {
  const t = Date.now();
  lastGlobalThemeAt.set(themeKey, t);

  let uMap = lastUserThemeAt.get(userId);
  if (!uMap) {
    uMap = new Map();
    lastUserThemeAt.set(userId, uMap);
  }
  uMap.set(themeKey, t);
}

// ======= TEMAS =======
const THEMES = [
  {
    key: "menu",
    triggers: ["menu", "ajuda", "comandos", "opcoes", "opções", "help"],
    variants: [
      () => [
        "🤖 MENU DO BOT - DETRAN",
        "",
        "• transferência",
        "• intenção de venda",
        "• comunicação de venda",
        "• atpv / atpv-e",
        "• crlv / licenciamento",
        "• vistoria",
        "• débitos / multas / ipva",
        "• 2ª via",
        "",
        "Digite o assunto na conversa (ex: 'transferencia', 'multas', '2 via')",
        "",
        "⚠️ Links e vídeos são automaticamente removidos."
      ].join("\n"),
      () => [
        "📌 COMANDOS DISPONÍVEIS",
        "",
        "transferência | intenção de venda | comunicação de venda",
        "atpv | crlv | vistoria | débitos | 2ª via",
        "",
        "Mencione o tema no chat para receber informações baseadas no CTB."
      ].join("\n"),
      () => [
        "✅ AJUDA RÁPIDA - DETRAN",
        "",
        "Temas disponíveis:",
        "1. Transferência de veículo",
        "2. Intenção de venda",
        "3. Comunicação de venda",
        "4. ATPV-e",
        "5. CRLV/Licenciamento",
        "6. Vistoria/Inspeção",
        "7. Débitos/Multas/IPVA",
        "8. 2ª via de documentos",
        "",
        "Escreva o nome do tema que precisa."
      ].join("\n"),
      () => [
        "🤖 BOT DETRAN - MENU",
        "",
        "• transferência (compra/venda)",
        "• intenção de venda",
        "• comunicação de venda",
        "• atpv-e",
        "• crlv/licenciamento",
        "• vistoria/inspeção",
        "• débitos/multas/ipva",
        "• 2ª via/documentos",
        "",
        "Só escrever a palavra do tema que deseja."
      ].join("\n"),
    ],
  },

  {
    key: "transferencia",
    triggers: ["transferencia", "transferir", "mudanca de dono", "mudar de dono", "passar pro meu nome", "passar para meu nome", "comprei", "vendi", "compra e venda", "transfere", "mudança"],
    variants: [
      () => [
        "TRANSFERÊNCIA: mudança de proprietário após compra/venda/doação.",
        "",
        ctbLead(),
        "• ATPV-e (Autorização de Transferência)",
        "• CRLV (documento de licenciamento)",
        "• Identificação do comprador e vendedor",
        "• Comprovante de endereço atualizado",
        "• Vistoria veicular (quando exigida)",
        "• Débitos vinculados quitados (multas, IPVA, taxas)",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "TRANSFERIR VEÍCULO: processo para colocar no nome do novo dono.",
        "",
        ctbLead(),
        "• ATPV-e preenchida e validada",
        "• CRLV do ano em vigor",
        "• Documentos pessoais (RG e CPF)",
        "• Comprovante de endereço recente",
        "• Vistoria veicular (se exigida pelo órgão)",
        "• Regularização de todas as pendências",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "COMPRA E VENDA: transferência deve ser formalizada no órgão de trânsito.",
        "",
        ctbLead(),
        "• ATPV-e (documento principal da transferência)",
        "• CRLV do veículo",
        "• Documentos originais das partes",
        "• Comprovante de residência",
        "• Quitação de débitos do veículo",
        "• Vistoria quando necessário",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "MUDANÇA DE PROPRIETÁRIO: atualização do registro do veículo.",
        "",
        ctbLead(),
        "• ATPV-e assinada por ambas as partes",
        "• CRLV em dia",
        "• Identificação completa (comprador/vendedor)",
        "• Endereço atualizado",
        "• Vistoria conforme exigência estadual",
        "• Comprovante de quitação de débitos",
        "",
        helpLine()
      ].join("\n"),
    ],
  },

  {
    key: "intencao_venda",
    triggers: ["intencao de venda", "intenção de venda", "vou vender", "pretendo vender", "quero vender", "anunciar carro", "vender o carro", "vender o veiculo", "vender o veículo", "venda", "anunciar"],
    variants: [
      () => [
        "INTENÇÃO DE VENDA: prepare tudo antes de vender para não travar a transferência.",
        "",
        ctbLead(),
        "• CRLV atualizado (licenciamento em dia)",
        "• Documento de identificação do proprietário",
        "• Comprovante de endereço atual",
        "• Situação regular do veículo (sem débitos impeditivos)",
        "• Veículo sem restrições ou apreensões",
        "",
        "📌 Dica: verifique multas, IPVA e taxas antes. Tenha a ATPV-e pronta.",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "VOU VENDER: organize a documentação antes de fechar negócio.",
        "",
        ctbLead(),
        "• CRLV do veículo",
        "• Documento do vendedor (RG e CPF)",
        "• Comprovante de endereço",
        "• Consulta de débitos vinculados",
        "• Verificação de restrições",
        "",
        "📌 Combine com o comprador todos os passos da transferência.",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "PREPARAÇÃO PARA VENDA: evite problemas após a venda.",
        "",
        ctbLead(),
        "• CRLV em dia",
        "• Documentos pessoais em ordem",
        "• Endereço atualizado no sistema",
        "• Regularidade total do veículo",
        "• Nenhuma pendência administrativa",
        "",
        "⚠️ Não entregue o veículo sem iniciar a transferência formal.",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "ANTES DE VENDER: etapa de organização documental.",
        "",
        ctbLead(),
        "• CRLV válido",
        "• Identificação do proprietário",
        "• Comprovante de endereço",
        "• Verificação completa de pendências",
        "• Multas, IPVA e taxas quitadas",
        "",
        "📌 A transferência pode exigir vistoria dependendo do caso.",
        "",
        helpLine()
      ].join("\n"),
    ],
  },

  {
    key: "comunicacao_venda",
    triggers: ["comunicacao de venda", "comunicação de venda", "comunicar venda", "aviso de venda", "venda comunicada", "vendi e nao transferiu", "vendi e não transferiu", "comprador nao transferiu", "comprador não transferiu", "vendi e não passou"],
    variants: [
      () => [
        "COMUNICAÇÃO DE VENDA: protege o vendedor após a venda.",
        "",
        "📄 CTB Art. 134: O antigo proprietário deve comunicar a venda ao órgão de trânsito com cópia do comprovante assinado, para evitar responsabilidade solidária por infrações até a data da comunicação.",
        "",
        ctbLead(),
        "• ATPV-e/recibo de venda assinado e datado",
        "• Documento do vendedor",
        "• Dados do veículo (placa e RENAVAM)",
        "• Comprovante do comunicado",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "VENDI E O COMPRADOR NÃO TRANSFERIU: comunique para se resguardar.",
        "",
        "📄 CTB Art. 134: A responsabilidade pode recair sobre o antigo dono até que a comunicação seja feita.",
        "",
        ctbLead(),
        "• Comprovante de venda/transferência assinado",
        "• Identificação completa do vendedor",
        "• Placa e RENAVAM do veículo",
        "• Data da venda",
        "",
        "📌 A comunicação NÃO substitui a transferência definitiva.",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "COMUNICAR A VENDA: registro administrativo importante.",
        "",
        "📄 CTB Art. 134: Comunique ao órgão com comprovante assinado.",
        "",
        ctbLead(),
        "• ATPV-e/recibo assinado pelas partes",
        "• Documentos do vendedor",
        "• Dados completos do veículo",
        "• Comprovante de entrega da comunicação",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "PROTEÇÃO DO VENDEDOR: comunicação de venda é essencial.",
        "",
        "📄 CTB Art. 134: Evite responsabilidade por multas após a venda.",
        "",
        ctbLead(),
        "• Documento de transferência assinado",
        "• Identificação do vendedor",
        "• Placa/RENAVAM do veículo",
        "• Guarde todos os comprovantes",
        "",
        "📌 Faça a comunicação imediatamente após a venda.",
        "",
        helpLine()
      ].join("\n"),
    ],
  },

  {
    key: "atpv",
    triggers: ["atpv", "atpv-e", "atpve", "autorizacao de transferencia", "autorização de transferência", "atpv e", "formulario transferencia", "formulário transferência"],
    variants: [
      () => [
        "ATPV-e: autorização eletrônica para transferência de veículo.",
        "",
        ctbLead(),
        "• Dados completos do veículo",
        "• Identificação das partes (comprador/vendedor)",
        "• Assinaturas conforme exigência",
        "• Validação pelo órgão competente",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "ATPV/ATPV-e: documento base para transferência.",
        "",
        ctbLead(),
        "• Dados do veículo (placa, RENAVAM, etc)",
        "• Comprador e vendedor devidamente identificados",
        "• Assinatura/validação exigida",
        "• Situação regular do veículo",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "ATPV-e: registro oficial do ato de transferência.",
        "",
        ctbLead(),
        "• Identificação completa das partes",
        "• Dados técnicos do veículo",
        "• Assinatura e validação",
        "• Regularidade do veículo",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "AUTORIZAÇÃO DE TRANSFERÊNCIA (ATPV-e): documento obrigatório.",
        "",
        ctbLead(),
        "• Documentação do veículo",
        "• Dados pessoais do comprador/vendedor",
        "• Assinaturas legais",
        "• Validação administrativa",
        "",
        helpLine()
      ].join("\n"),
    ],
  },

  {
    key: "crlv",
    triggers: ["crlv", "licenciamento", "licenciar", "crlv-e", "crlve", "documento do carro", "documento veículo", "documento veiculo"],
    variants: [
      () => [
        "CRLV: documento que comprova o licenciamento anual do veículo.",
        "",
        ctbLead(),
        "• Quitação de débitos vinculados (multas, IPVA)",
        "• Quitação de taxas administrativas",
        "• Exigências específicas atendidas",
        "• Vistoria quando aplicável",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "LICENCIAMENTO/CRLV: obrigatório para circular regularmente.",
        "",
        ctbLead(),
        "• Regularização de multas pendentes",
        "• Pagamento de tributos (IPVA)",
        "• Taxas administrativas em dia",
        "• Cumprimento de exigências do órgão",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "CRLV-e: emissão depende da regularidade do veículo.",
        "",
        ctbLead(),
        "• Débitos vinculados quitados",
        "• Pendências regularizadas",
        "• Situação administrativa regular",
        "• Vistoria quando necessária",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "DOCUMENTO DE LICENCIAMENTO (CRLV): necessário para trânsito.",
        "",
        ctbLead(),
        "• Pagamentos em dia (multas, IPVA, taxas)",
        "• Pendências resolvidas",
        "• Veículo em situação regular",
        "• Exigências atendidas",
        "",
        helpLine()
      ].join("\n"),
    ],
  },

  {
    key: "vistoria",
    triggers: ["vistoria", "inspecao", "inspeção", "laudo", "vistoria veicular", "inspeção veicular", "vistoriar"],
    variants: [
      () => [
        "VISTORIA/INSPEÇÃO: conferência obrigatória em diversos casos.",
        "",
        ctbLead(),
        "• Documento do veículo (CRLV)",
        "• Documento do proprietário/solicitante",
        "• Apresentação do veículo para inspeção",
        "• Taxa de vistoria (quando aplicável)",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "VISTORIA VEICULAR: exigida para transferência e alterações.",
        "",
        ctbLead(),
        "• Documentação do veículo",
        "• Identificação do responsável",
        "• Veículo disponível para inspeção",
        "• Agendamento (conforme necessário)",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "INSPEÇÃO TÉCNICA: validação de dados e condições do veículo.",
        "",
        ctbLead(),
        "• Documentos originais do veículo",
        "• Documento pessoal do proprietário",
        "• Veículo em condições de inspeção",
        "• Pagamento de taxas quando devido",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "VISTORIA: etapa de segurança do registro veicular.",
        "",
        ctbLead(),
        "• Documentação completa do veículo",
        "• Identificação do solicitante",
        "• Veículo apresentado para verificação",
        "• Cumprimento de normas técnicas",
        "",
        helpLine()
      ].join("\n"),
    ],
  },

  {
    key: "debitos",
    triggers: ["debito", "debitos", "multa", "multas", "ipva", "taxa", "taxas", "pendencia", "pendência", "pendências", "dívida", "dívidas", "bloqueio", "restrição", "restricao", "impedimento"],
    variants: [
      () => [
        "DÉBITOS/PENDÊNCIAS: impedem licenciamento e transferência.",
        "",
        ctbLead(),
        "• Consulta de débitos vinculados",
        "• Quitação de multas de trânsito",
        "• Pagamento de IPVA e taxas",
        "• Comprovantes de pagamento guardados",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "MULTAS/IPVA/TAXAS: regularize antes de procedimentos.",
        "",
        ctbLead(),
        "• Consulta de débitos no sistema",
        "• Pagamento/regularização completa",
        "• Comprovantes para comprovação",
        "• Aguardar atualização do sistema",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "PENDÊNCIAS: resolva todas antes de transferir ou licenciar.",
        "",
        ctbLead(),
        "• Verificação de multas pendentes",
        "• Quitação de tributos (IPVA)",
        "• Pagamento de taxas administrativas",
        "• Regularização total do veículo",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "DÉBITOS VINCULADOS: impedem emissão de documentos.",
        "",
        ctbLead(),
        "• Consulta detalhada de débitos",
        "• Quitação integral",
        "• Comprovação de pagamento",
        "• Atualização do sistema",
        "",
        helpLine()
      ].join("\n"),
    ],
  },

  {
    key: "segunda_via",
    triggers: ["2 via", "segunda via", "perdi documento", "roubado", "danificado", "documento perdido", "documento roubado", "rasgado", "queimado", "extraviado", "2ª via"],
    variants: [
      () => [
        "2ª VIA: reemissão por perda, roubo ou dano.",
        "",
        ctbLead(),
        "• Identificação do proprietário",
        "• Dados do veículo (placa/RENAVAM)",
        "• Regularidade do veículo (débitos)",
        "• Boletim de Ocorrência (quando roubo/furto)",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "SEGUNDA VIA DE DOCUMENTOS: procedimento para reemissão.",
        "",
        ctbLead(),
        "• Documento pessoal do proprietário",
        "• Dados completos do veículo",
        "• Quitação de débitos (quando exigido)",
        "• BO (para casos de roubo/furto)",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "REEMISSÃO DE DOCUMENTOS: siga as exigências.",
        "",
        ctbLead(),
        "• Identificação válida",
        "• Informações do veículo",
        "• Situação regular do veículo",
        "• Documentação comprobatória",
        "",
        helpLine()
      ].join("\n"),
      () => [
        "2ª VIA: dependente da situação do veículo.",
        "",
        ctbLead(),
        "• Identificação do proprietário",
        "• Dados para localização do veículo",
        "• Pendências regularizadas (se exigido)",
        "• Comprovantes necessários",
        "",
        helpLine()
      ].join("\n"),
    ],
  },
];

// ======= CLIENTE =======
const client = new Client({
  authStrategy: new LocalAuth({ 
    clientId: "bot-detran-render"
  }),
  puppeteer: {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// ======= PATCH sendSeen =======
let patchedSendSeen = false;
async function ensurePatchedSendSeen() {
  if (patchedSendSeen) return;
  try {
    if (!client.pupPage) return;
    await client.pupPage.evaluate(() => {
      if (window.WWebJS && typeof window.WWebJS.sendSeen === "function") {
        window.WWebJS.sendSeen = async () => { };
      }
    });
    patchedSendSeen = true;
    console.log("✅ Patch sendSeen aplicado.");
  } catch (e) {
    console.log("⚠️ Patch sendSeen falhou:", e?.message || e);
  }
}

// ======= HELPERS =======
async function safeDeleteMessage(msg, forEveryone = true) {
  try {
    await msg.delete(forEveryone);
  } catch (e) {
    console.log("⚠️ Erro ao deletar mensagem:", e?.message || e);
  }
}

async function safeSendMessage(chat, text) {
  try {
    await ensurePatchedSendSeen();
    return await chat.sendMessage(text);
  } catch (e) {
    console.log("⚠️ Falha ao enviar mensagem:", e?.message || e);
    return null;
  }
}

// ======= EVENTOS =======
client.on("qr", (qr) => {
  console.log("🔐 ESCANEIE O QR CODE COM O WHATSAPP DO CELULAR:");
  qrcode.generate(qr, { small: true });
  console.log("📱 Abra o WhatsApp > Menu > Dispositivos conectados > Conectar um dispositivo");
});

client.on("ready", async () => {
  console.log("✅ BOT FUNCIONANDO!");
  console.log("✅ Conectado como:", client.info.pushname);
  console.log("⚠️ IMPORTANTE: Para apagar mensagens, o bot precisa ser ADMIN do grupo.");
  await ensurePatchedSendSeen();
});

client.on("authenticated", () => {
  console.log("✅ Autenticado com sucesso!");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Falha na autenticação:", msg);
});

client.on("disconnected", (reason) => {
  console.log("❌ Cliente desconectado:", reason);
  console.log("🔄 Reinicie o bot para reconectar.");
});

// ======= HANDLER PRINCIPAL =======
client.on("message", async (msg) => {
  try {
    // DEBUG: Log simples
    console.log(`📨 [${new Date().toLocaleTimeString()}] De: ${msg.from.slice(0, 15)}... | Msg: "${msg.body?.slice(0, 30)}${msg.body?.length > 30 ? '...' : ''}"`);

    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const body = msg.body || "";
    const bodyNorm = normalizeText(body);

    // Anti-loop: não responde às próprias mensagens formatadas
    if (msg.fromMe && body.startsWith("```")) return;

    // Anti-vídeo (apaga + aviso)
    if (!msg.fromMe && msg.hasMedia && msg.type === "video") {
      console.log("🎥 Vídeo detectado - deletando");
      await safeDeleteMessage(msg, true);
      const aviso = await safeSendMessage(chat, warnLine());
      if (aviso) setTimeout(() => safeDeleteMessage(aviso, true), DELETE_WARNING_AFTER_MS);
      return;
    }

    // Anti-link (apaga + aviso)
    if (!msg.fromMe && bodyNorm && hasLink(bodyNorm)) {
      console.log("🔗 Link detectado - deletando");
      await safeDeleteMessage(msg, true);
      const aviso = await safeSendMessage(chat, warnLine());
      if (aviso) setTimeout(() => safeDeleteMessage(aviso, true), DELETE_WARNING_AFTER_MS);
      return;
    }

    // Só processa texto puro
    if (!bodyNorm || msg.type !== "chat") return;

    // Identifica tema
    const theme = THEMES.find(t =>
      t.triggers.some(tr => bodyNorm.includes(normalizeText(tr)))
    );
    
    if (!theme) return;

    // User ID para rate limit
    const userId = msg.author || msg.from || "unknown";

    // Rate limit
    if (!canRespond(theme.key, userId)) {
      console.log(`⏳ Rate limit atingido para ${theme.key} (usuário: ${userId.slice(0, 10)}...)`);
      return;
    }
    
    markResponded(theme.key, userId);

    // Escolhe variação diferente
    const lastV = lastVariantByTheme.get(theme.key) || null;
    const variantFn = pickDifferent(theme.variants, lastV);
    lastVariantByTheme.set(theme.key, variantFn);

    // Envia resposta
    console.log(`📤 Enviando resposta: ${theme.key}`);
    const text = variantFn();
    const sent = await safeSendMessage(chat, monospaceBlock(text));
    
    if (sent) {
      console.log(`✅ Resposta enviada (auto-exclui em ${DELETE_NORMATIVE_AFTER_MS/1000}s)`);
      setTimeout(() => {
        safeDeleteMessage(sent, true);
        console.log(`🗑️ Resposta do tema ${theme.key} auto-excluída`);
      }, DELETE_NORMATIVE_AFTER_MS);
    }

  } catch (e) {
    console.log("⚠️ Erro no handler de mensagens:", e?.message || e);
  }
});

// ======= INICIALIZAÇÃO =======
console.log("🚀 Iniciando Bot WhatsApp Detran...");
console.log("⏳ Aguardando conexão...");
client.initialize();