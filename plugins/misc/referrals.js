module.exports = {
  help: ["invite [numero]", "invitados"],
  tags: ["misc"],
  command: /^(invite|invitar|invitados)$/i,
  run: async (m, { conn, Func }) => {
    try {
      const users = global.db.users[m.sender];
      const [cmd, ...args] = m.body.slice(1).trim().split(" ");
      const command = cmd.toLowerCase();

      if (command === "invite" || command === "invitar") {
        const refNumber = args[0] ? args[0].replace(/[^0-9]/g, "") : null;
        if (!refNumber) {
          return m.reply(`Uso correcto:\n\`.invite [número]\`\n\nEjemplo: \`.invite ${m.sender.split("@")[0]}\``);
        }

        const refJid = refNumber + "@s.whatsapp.net";
        if (refJid === m.sender) {
          return m.reply("❌ No puedes invitarte a ti mismo.");
        }

        if (!global.db.users[refJid]) {
          return m.reply("❌ El código o número de invitación de esa persona no es válido o no está registrado.");
        }

        if (users.referredBy) {
          return m.reply(`Ya fuiste invitado anteriormente por @${users.referredBy.split("@")[0]}.`, null, { mentions: [users.referredBy] });
        }

        users.referredBy = refJid;
        const referrer = global.db.users[refJid];
        referrer.referralsCount = (referrer.referralsCount || 0) + 1;

        await global.conn?.db?.write?.(global.db);

        await m.reply(`🎉 ¡Has sido registrado como invitado de @${refJid.split("@")[0]}! Gracias por unirte a YOSHIDA Bot.`, null, { mentions: [refJid] });

        // Notify referrer if unlocked
        if (referrer.referralsCount >= 3 && !referrer.unlockedFree) {
          referrer.unlockedFree = true;
          await conn.sendMessage(refJid, {
            text: `🎉 *¡FelicIDADES!* 🎉\n\nHas completado tus 3 invitaciones con éxito. Tu cuenta ha sido desbloqueada de forma *ILIMITADA* para hablar libremente conmigo. ¡Que lo disfrutes!`
          });
        } else {
          await conn.sendMessage(refJid, {
            text: `🔔 *NUEVO INVITADO* 🔔\n\nEl usuario @${m.sender.split("@")[0]} se ha registrado con tu enlace de invitación.\n\n*Progreso:* ${referrer.referralsCount}/3 invitados.`,
            mentions: [m.sender]
          });
        }
      }

      else if (command === "invitados") {
        const referralsCount = users.referralsCount || 0;
        const limit = global.db.setting.referralsRequired || 3;
        const status = users.unlockedFree || referralsCount >= limit ? "🔓 ILIMITADO (Desbloqueado)" : "🔒 LIMITADO (10 mensajes)";

        let txt = `📊 *ESTADO DE INVITADOS* 📊\n\n`;
        txt += `◦  *Tus invitados:* ${referralsCount} / ${limit}\n`;
        txt += `◦  *Estado:* ${status}\n\n`;
        if (referralsCount < limit) {
          const pairingNum = process.env.PAIRING_NUMBER || "5355493444";
          txt += `*Tu enlace de invitación:*\nhttps://wa.me/${pairingNum}?text=.invite+${m.sender.split("@")[0]}\n\n¡Comparte este enlace con 3 amigos para desbloquear el acceso ilimitado de forma gratuita!`;
        } else {
          txt += `¡Felicidades! Tienes acceso ilimitado.`;
        }

        await m.reply(txt);
      }

    } catch (e) {
      console.error(e);
      m.reply(`Error en el sistema de referidos: ${e.message}`);
    }
  }
};
