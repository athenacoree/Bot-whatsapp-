const { generateAIResponse } = require("@system/aiService");

module.exports = {
  before: async (m, { conn }) => {
    try {
      const isRelevantMessage =
        (global.db.users[m.sender]?.activity?.aiHistory &&
          global.db.users[m.sender].activity.aiHistory.length > 0 &&
          m.isQuoted &&
          m.quoted.fromMe) ||
        (Array.isArray(m.mentions) && m.mentions.includes(conn.user.jid));

      if (!isRelevantMessage) {
        return true;
      }

      if (m.isBot) return true;

      const prefix = m.prefix || ".";
      if (m.body && m.body.startsWith(prefix)) {
        return true;
      }

      const response = await generateAIResponse(m, m.body, conn);
      if (response) {
        await m.reply(response);
      }
      return true;
    } catch (error) {
      console.error("Error in interactive AI handler:", error);
      return true;
    }
  },
  limit: 1,
};
