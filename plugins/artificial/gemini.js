const { generateAIResponse } = require("@system/aiService");

module.exports = {
  help: ["ai", "gemini", "resetaichat"],
  tags: ["ai"],
  command: /^(gemini|ai|resetaichat)$/i,
  run: async (m, { Func, conn }) => {
    try {
      if (m.command === "resetaichat") {
        if (!global.db.users[m.sender]) global.db.users[m.sender] = {};
        if (!global.db.users[m.sender].activity) global.db.users[m.sender].activity = {};
        global.db.users[m.sender].activity.aiHistory = [];
        return m.reply("El historial de chat de la IA ha sido reseteado con éxito.");
      }

      let text =
        m.args.length >= 1
          ? m.args.join(" ")
          : m.isQuoted && m.quoted.text
            ? m.quoted.text
            : null;

      if (!text) return m.reply(Func.example(m.prefix, m.command, "hola"));

      const response = await generateAIResponse(m, text, conn);
      if (response) {
        await m.reply(response);
      }
    } catch (error) {
      console.error("Error in AI command plugin:", error);
      m.reply(`Error: ${error.message}`);
    }
  },
  limit: 1,
};
