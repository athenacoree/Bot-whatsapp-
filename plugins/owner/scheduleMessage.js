const moment = require("moment-timezone");

module.exports = {
  help: ["schedule [fecha/hora] | [mensaje]"],
  tags: ["owner"],
  command: /^(schedule|programar)$/i,
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
        return m.reply("No tienes permisos de administrador para programar mensajes.");
      }

      const bodyText = m.args.join(" ");
      if (!bodyText || !bodyText.includes("|")) {
        return m.reply("Uso incorrecto del comando.\n\nFormato:\n`.schedule AAAA-MM-DD HH:MM | Mensaje` o `.schedule HH:MM | Mensaje`\n\nEjemplo:\n`.schedule 2025-05-15 14:30 | Mensaje de prueba` o `.schedule 18:00 | Hola, feliz tarde!`");
      }

      const parts = bodyText.split("|");
      const dateStr = parts[0].trim();
      const message = parts.slice(1).join("|").trim();

      if (!message) {
        return m.reply("Por favor, ingresa el mensaje a enviar.");
      }

      let targetTime;
      const tz = process.env.TZ || "America/Havana";

      if (dateStr.includes("-")) {
        // Complete date: AAAA-MM-DD HH:MM
        targetTime = moment.tz(dateStr, "YYYY-MM-DD HH:mm", tz);
      } else {
        // Time only: HH:MM (defaults to today, or tomorrow if the time has already passed)
        targetTime = moment.tz(dateStr, "HH:mm", tz);
        if (targetTime.isBefore(moment())) {
          targetTime.add(1, 'day');
        }
      }

      if (!targetTime.isValid()) {
        return m.reply("Formato de fecha u hora inválido. Asegúrate de usar `AAAA-MM-DD HH:MM` o `HH:MM`.");
      }

      const timestamp = targetTime.valueOf();

      if (timestamp <= Date.now()) {
        return m.reply("La fecha y hora especificadas ya han pasado. Por favor ingresa una fecha futura.");
      }

      if (!global.db.scheduledMessages) {
        global.db.scheduledMessages = [];
      }

      const newMsg = {
        id: "sch_" + Date.now().toString(36),
        time: timestamp,
        message: message,
        target: "all", // Broadcasts to all users
        status: "pending",
        createdAt: Date.now()
      };

      global.db.scheduledMessages.push(newMsg);
      await global.conn?.db?.write?.(global.db);

      const formattedDate = targetTime.format("YYYY-MM-DD HH:mm:ss");
      await m.reply(`✅ *MENSAJE PROGRAMADO CON ÉXITO* ✅\n\n◦  *Mensaje:* ${message}\n◦  *Fecha de envío:* ${formattedDate} (${tz})\n◦  *ID:* ${newMsg.id}\n\nEl mensaje se enviará automáticamente cuando llegue el momento.`);

    } catch (e) {
      console.error(e);
      m.reply(`Ocurrió un error al programar el mensaje: ${e.message}`);
    }
  }
};
