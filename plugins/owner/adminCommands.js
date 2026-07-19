const moment = require("moment-timezone");

module.exports = {
  command: /^(stats|users|block|unblock|broadcast|config|set|mcp)$/i,
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
        return m.reply("No tienes permisos de administrador para ejecutar este comando.");
      }

      const [cmd, ...args] = m.body.slice(1).trim().split(" ");
      const command = cmd.toLowerCase();

      switch (command) {
        case "stats": {
          const totalUsers = Object.keys(global.db.users || {}).length;
          const uptime = process.uptime();
          const hrs = Math.floor(uptime / 3600);
          const mins = Math.floor((uptime % 3600) / 60);
          const secs = Math.floor(uptime % 60);

          let hitStats = Object.values(global.db.stats || {}).reduce((sum, { hitstat }) => sum + hitstat, 0);

          let txt = `乂  *E S T A D Í S T I C A S  D E L  B O T*\n\n`;
          txt += `◦  *Total de Usuarios:* ${totalUsers}\n`;
          txt += `◦  *Uptime:* ${hrs}h ${mins}m ${secs}s\n`;
          txt += `◦  *Total de Comandos:* ${hitStats}\n`;
          txt += `◦  *Plataforma:* NodeJS ${process.version}\n`;
          txt += `◦  *Modo del Bot:* ${setting.self_mode ? 'Privado (Self)' : 'Público'}\n`;
          txt += `◦  *Absence Mode:* ${setting.absenceMode ? 'Activado' : 'Desactivado'}\n`;

          await m.reply(txt);
          break;
        }

        case "users": {
          const list = Object.entries(global.db.users || {})
            .map(([jid, u]) => `◦  *@${u.name || jid.split("@")[0]}* (${jid.split("@")[0]})\n    - Edad: ${u.age || "N/A"} | Sexo: ${u.sex || "N/A"}\n    - Registrado: ${u.registered ? 'Sí' : 'No'} | Premium: ${u.premium ? 'Sí' : 'No'} | Baneado: ${u.banned ? 'Sí' : 'No'}`)
            .join("\n\n");

          await conn.sendMessage(m.chat, {
            text: `乂  *U S U A R I O S  R E G I S T R A D O S*\n\n${list || "No hay usuarios registrados."}`,
            mentions: Object.keys(global.db.users || {})
          });
          break;
        }

        case "block": {
          let who = m.isQuoted ? m.quoted.sender : m.mentions && m.mentions[0] ? m.mentions[0] : null;
          if (!who && args[0]) {
            who = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
          }
          if (!who) return m.reply("Menciona a un usuario o ingresa su número para bloquearlo.");

          if (!global.db.users[who]) global.db.users[who] = {};
          global.db.users[who].banned = true;
          await m.reply(`El usuario @${who.split("@")[0]} ha sido bloqueado exitosamente.`, null, { mentions: [who] });
          break;
        }

        case "unblock": {
          let who = m.isQuoted ? m.quoted.sender : m.mentions && m.mentions[0] ? m.mentions[0] : null;
          if (!who && args[0]) {
            who = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
          }
          if (!who) return m.reply("Menciona a un usuario o ingresa su número para desbloquearlo.");

          if (!global.db.users[who]) global.db.users[who] = {};
          global.db.users[who].banned = false;
          await m.reply(`El usuario @${who.split("@")[0]} ha sido desbloqueado exitosamente.`, null, { mentions: [who] });
          break;
        }

        case "broadcast": {
          const text = args.join(" ");
          if (!text) return m.reply("Ingresa el mensaje que deseas difundir a todos los usuarios.");

          const usersList = Object.keys(global.db.users || {}).filter(jid => jid !== m.sender);
          await m.reply(`Iniciando difusión masiva a ${usersList.length} usuarios...`);

          for (let jid of usersList) {
            try {
              await conn.sendMessage(jid, { text: `📢 *DIFUSIÓN ADMINISTRADOR*\n\n${text}` });
              await Func.delay(2000);
            } catch (err) {
              console.error(`Error enviando difusión a ${jid}:`, err);
            }
          }
          await m.reply("Difusión masiva completada con éxito.");
          break;
        }

        case "config": {
          let configTxt = `乂  *C O N F I G U R A C I Ó N  A C T U A L*\n\n`;
          configTxt += `◦  *Bot Name:* ${setting.botName || "YOSHIDA"}\n`;
          configTxt += `◦  *Prefix:* ${setting.prefix || "."}\n`;
          configTxt += `◦  *Self Mode:* ${setting.self_mode ? "Activado (Privado)" : "Desactivado (Público)"}\n`;
          configTxt += `◦  *Absence Mode:* ${setting.absenceMode ? "Activado" : "Desactivado"}\n`;
          configTxt += `◦  *Absence Message:* ${setting.absenceMessage}\n`;
          configTxt += `◦  *AI Provider:* ${global.db.aiConfig.provider}\n`;
          configTxt += `◦  *AI Model:* ${global.db.aiConfig.model}\n`;
          configTxt += `◦  *10 Mensajes Gratis:* ${global.db.setting.freeMessagesLimitDisabled ? "Desactivado" : "Activado (" + (global.db.setting.freeMessagesLimit || 10) + " mensajes)"}\n`;

          await m.reply(configTxt);
          break;
        }

        case "set": {
          if (args.length < 2) return m.reply("Uso: `.set [clave] [valor]`\nEjemplo: `.set self_mode true` o `.set freeMessagesLimit 15`");
          const key = args[0];
          const val = args.slice(1).join(" ");

          let parsedVal = val;
          if (val === "true") parsedVal = true;
          else if (val === "false") parsedVal = false;
          else if (!isNaN(parseInt(val))) parsedVal = parseInt(val);

          if (key in setting) {
            setting[key] = parsedVal;
            await m.reply(`Configuración cambiada: *setting.${key}* = ${parsedVal}`);
          } else if (key in global.db.aiConfig) {
            global.db.aiConfig[key] = parsedVal;
            await m.reply(`Configuración cambiada: *aiConfig.${key}* = ${parsedVal}`);
          } else {
            setting[key] = parsedVal;
            await m.reply(`Añadida nueva configuración: *setting.${key}* = ${parsedVal}`);
          }
          break;
        }

        case "mcp": {
          const servers = global.db.aiConfig.mcpServers || [];
          if (servers.length === 0) return m.reply("No hay servidores MCP configurados en este momento.");

          let txt = `乂  *S E R V I D O R E S  M C P  C O N E C T A D O S*\n\n`;
          servers.forEach((srv, idx) => {
            txt += `${idx + 1}. *${srv.name}*\n   - URL: ${srv.url}\n`;
          });
          await m.reply(txt);
          break;
        }
      }
    } catch (e) {
      console.error(e);
      m.reply(`Ocurrió un error al procesar el comando administrativo: ${e.message}`);
    }
  }
};
