module.exports = {
  help: ["statuspost [texto]", "statuslist", "statusreply @usuario | [texto]"],
  tags: ["owner"],
  command: /^(statuspost|statuslist|statusreply)$/i,
  run: async (m, { conn, Func }) => {
    try {
      const setting = global.db.setting;
      const isAdmin = [
        conn.decodeJid(conn.user.id).split`@`[0],
        process.env.OWNER,
        "5351080807",
        ...(setting.owners || [])
      ]
        .map((v) => v + "@s.whatsapp.net")
        .includes(m.sender);

      if (!isAdmin) {
        return m.reply("No tienes permisos de administrador para gestionar los estados.");
      }

      const [cmd, ...args] = m.body.slice(1).trim().split(" ");
      const command = cmd.toLowerCase();

      switch (command) {
        case "statuspost": {
          const text = args.join(" ");
          if (!text) return m.reply("Ingresa el texto que deseas publicar en el estado de WhatsApp.");

          await conn.sendMessage("status@broadcast", { text: text }, { backgroundColor: "#7C3AED", font: 3 });
          await m.reply("¡Estado de WhatsApp publicado con éxito! 🎉");
          break;
        }

        case "statuslist": {
          const list = global.db.receivedStatuses || [];
          if (list.length === 0) return m.reply("No se han registrado estados recientes de tus contactos.");

          let txt = `乂  *E S T A D O S  D E  C O N T A C T O S*\n\n`;
          list.forEach((s, idx) => {
            txt += `${idx + 1}. *@${s.participant.split("@")[0]}*\n   - Contenido: ${s.text}\n   - Hace: ${Func.delay(Date.now() - s.timestamp)}\n\n`;
          });

          await conn.sendMessage(m.chat, {
            text: txt,
            mentions: list.map(s => s.participant)
          });
          break;
        }

        case "statusreply": {
          const bodyText = args.join(" ");
          if (!bodyText || !bodyText.includes("|")) {
            return m.reply("Formato incorrecto. Uso:\n`.statusreply @usuario | [mensaje]`");
          }

          let who = m.isQuoted ? m.quoted.sender : m.mentions && m.mentions[0] ? m.mentions[0] : null;
          const parts = bodyText.split("|");
          const replyText = parts.slice(1).join("|").trim();

          if (!who) {
            const userStr = parts[0].replace(/[^0-9]/g, "");
            if (userStr) who = userStr + "@s.whatsapp.net";
          }

          if (!who) return m.reply("Menciona al usuario o ingresa su número.");
          if (!replyText) return m.reply("Por favor ingresa el texto de respuesta.");

          const list = global.db.receivedStatuses || [];
          const userStatus = list.find(s => s.participant === who);

          if (!userStatus) {
            return m.reply(`No se encontró ningún estado reciente de @${who.split("@")[0]} en el registro del bot.`);
          }

          // Reply quoting the status message
          await conn.sendMessage(who, { text: replyText }, { quoted: { key: userStatus.key, message: { conversation: userStatus.text } } });
          await m.reply(`Respuesta enviada a @${who.split("@")[0]} sobre su estado.`);
          break;
        }
      }
    } catch (e) {
      console.error(e);
      m.reply(`Error en el gestor de estados: ${e.message}`);
    }
  }
};
