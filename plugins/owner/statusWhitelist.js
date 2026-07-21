module.exports = {
  help: ["permitirestado @usuario", "revocarestado @usuario"],
  tags: ["owner"],
  command: /^(permitirestado|revocarestado)$/i,
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
        return m.reply("No tienes permisos de administrador para gestionar la lista de estados permitidos.");
      }

      const [cmd, ...args] = m.body.slice(1).trim().split(" ");
      const command = cmd.toLowerCase();

      let who = m.isQuoted ? m.quoted.sender : m.mentions && m.mentions[0] ? m.mentions[0] : null;
      if (!who && args.length > 0) {
        const userStr = args.join(" ").replace(/[^0-9]/g, "");
        if (userStr) who = userStr + "@s.whatsapp.net";
      }

      if (!who) {
        return m.reply(`Por favor, menciona al usuario o ingresa su número para usar este comando.\nEjemplos:\n.${command} @usuario\n.${command} 5491122334455`);
      }

      if (!setting.statusReactWhitelist) {
        setting.statusReactWhitelist = [];
      }

      if (command === "permitirestado") {
        if (setting.statusReactWhitelist.includes(who)) {
          return m.reply(`El usuario @${who.split("@")[0]} ya está en la whitelist de estados.`);
        }
        setting.statusReactWhitelist.push(who);
        return m.reply(`Se ha otorgado permiso para reaccionar a los estados de @${who.split("@")[0]} con éxito. ✨`);
      } else if (command === "revocarestado") {
        if (!setting.statusReactWhitelist.includes(who)) {
          return m.reply(`El usuario @${who.split("@")[0]} no está en la whitelist de estados.`);
        }
        setting.statusReactWhitelist = setting.statusReactWhitelist.filter(jid => jid !== who);
        return m.reply(`Se ha revocado el permiso para reaccionar a los estados de @${who.split("@")[0]} con éxito. 🗑️`);
      }
    } catch (e) {
      console.error(e);
      m.reply(`Error: ${e.message}`);
    }
  }
};
