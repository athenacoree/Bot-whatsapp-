const { GoogleGenerativeAI } = require("@google/generative-ai");

const AGENTS = {
  investigador: {
    name: "Investigador",
    emoji: "🔍",
    prompt: "Eres el agente Investigador de YOSHIDA Bot. Tu especialidad es buscar y sintetizar información relevante de internet de forma objetiva, detallada y concisa. Estructura tus respuestas con viñetas claras."
  },
  programador: {
    name: "Programador",
    emoji: "💻",
    prompt: "Eres el agente Programador de YOSHIDA Bot. Escribes código de programación de altísima calidad en cualquier lenguaje, explicas conceptos técnicos, corriges errores y optimizas algoritmos detalladamente."
  },
  disenador: {
    name: "Diseñador",
    emoji: "🎨",
    prompt: "Eres el agente Diseñador de YOSHIDA Bot. Creas maravillosas paletas de colores, estructuras CSS modernas, layouts responsivos elegantes y das excelentes consejos de experiencia de usuario (UX)."
  },
  analista: {
    name: "Analista",
    emoji: "📊",
    prompt: "Eres el agente Analista de YOSHIDA Bot. Analizas conjuntos de datos, identificas patrones, calculas estadísticas y presentas conclusiones fundamentadas y análisis analíticos rigurosos."
  },
  creativo: {
    name: "Creativo",
    emoji: "💡",
    prompt: "Eres el agente Creativo de YOSHIDA Bot. Generas ideas sumamente innovadoras, historias atrapantes, slogans memorables y contenido de valor creativo para cualquier tipo de campaña o proyecto."
  },
  traductor: {
    name: "Traductor",
    emoji: "🌐",
    prompt: "Eres el agente Traductor de YOSHIDA Bot. Traduces con extrema precisión entre múltiples idiomas, preservando el tono, los modismos, la jerga y la intención del mensaje original."
  },
  marketing: {
    name: "Marketing",
    emoji: "📈",
    prompt: "Eres el agente de Marketing de YOSHIDA Bot. Diseñas estrategias publicitarias altamente efectivas, sugieres canales de adquisición de clientes, copys persuasivos y tácticas de conversión."
  },
  soporte: {
    name: "Soporte",
    emoji: "🛠️",
    prompt: "Eres el agente de Soporte Técnico de YOSHIDA Bot. Respondes preguntas frecuentes del sistema de manera empática, clara, amable y resuelves problemas técnicos paso a paso."
  },
  estratega: {
    name: "Estratega",
    emoji: "♟️",
    prompt: "Eres el agente Estratega de YOSHIDA Bot. Desglosas tareas sumamente complejas y metas ambiciosas en planes de acción estratégicos detallados paso a paso con hitos alcanzables."
  },
  monitor: {
    name: "Monitor",
    emoji: "🖥️",
    prompt: "Eres el agente Monitor de YOSHIDA Bot. Analizas el rendimiento de sistemas, consumo de memoria, latencia de respuesta de los servidores, y recomiendas optimizaciones avanzadas de infraestructura."
  }
};

module.exports = {
  help: [
    "agente [nombre] [mensaje]",
    "investigador [mensaje]",
    "programador [mensaje]",
    "disenador [mensaje]",
    "analista [mensaje]",
    "creativo [mensaje]",
    "traductor [mensaje]",
    "marketing [mensaje]",
    "soporte [mensaje]",
    "estratega [mensaje]",
    "monitor [mensaje]"
  ],
  tags: ["ai"],
  command: /^(agente|investigador|programador|disenador|analista|creativo|traductor|marketing|soporte|estratega|monitor)$/i,
  run: async (m, { conn, Func }) => {
    try {
      const command = m.command.toLowerCase();
      let agentKey = "";
      let userQuery = "";

      if (command === "agente") {
        if (m.args.length < 2) {
          return m.reply(`Uso correcto:\n\`.agente [nombre_agente] [tu consulta]\`\n\n*Agentes disponibles:*\n${Object.keys(AGENTS).map(k => `◦  *${k}* - ${AGENTS[k].name}`).join("\n")}`);
        }
        agentKey = m.args[0].toLowerCase();
        userQuery = m.args.slice(1).join(" ");
      } else {
        agentKey = command === "disenador" ? "disenador" : command;
        userQuery = m.args.join(" ");
      }

      if (!AGENTS[agentKey]) {
        return m.reply(`❌ Agente no válido.\n\n*Elige uno de los siguientes:*\n${Object.keys(AGENTS).map(k => `◦  *${k}*`).join("\n")}`);
      }

      if (!userQuery) {
        return m.reply(`Por favor, ingresa tu consulta para el agente *${AGENTS[agentKey].name}*.`);
      }

      const agent = AGENTS[agentKey];
      await m.reply(`🤖 *AGENTE ESPECIALIZADO ACTIVADO* 🤖\n\n*Agente:* ${agent.emoji} ${agent.name}\n*Procesando tu solicitud...*`);

      const aiConfig = global.db.aiConfig || {};
      const apiKey = aiConfig.apiKey || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return m.reply("❌ Error: No se ha configurado la API Key de Google Gemini.");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: agent.prompt
      });

      const result = await model.generateContent(userQuery);
      const response = await result.response;
      const text = response.text();

      let replyTxt = `🤖 *AGENTE:* ${agent.emoji} *${agent.name.toUpperCase()}*\n\n${text}\n\n_Asistente de YOSHIDA Bot_`;
      await m.reply(replyTxt);

    } catch (e) {
      console.error(e);
      m.reply(`❌ Ocurrió un error con el agente especializado: ${e.message}`);
    }
  }
};
