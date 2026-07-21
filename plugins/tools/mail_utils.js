module.exports = {
  help: ["tempmail", "checkmail"],
  tags: ["tools"],
  command: /^(tempmail|checkmail)$/i,
  run: async (m, { conn, command, args, Func }) => {
    const cmd = command.toLowerCase();

    // 1. Temp Mail Generator
    if (cmd === "tempmail") {
      try {
        const res = await fetch("https://www.1secmail.com/api/v1/?action=genRandomMailbox&count=1");
        if (res.ok) {
          const emails = await res.json();
          const email = emails[0];
          await m.reply(`*📨 CORREO TEMPORAL CREADO*\n\n*Email:* ${email}\n\n*Instrucciones:*\nUsa este email para registrarte en cualquier sitio. Para revisar la bandeja de entrada de este correo, envía:\n*${m.prefix}checkmail ${email}*`);
        } else {
          throw new Error("Temporary mail service is busy");
        }
      } catch (e) {
        await m.reply(`⚠️ Error generando correo temporal: ${e.message}`);
      }
    }

    // 2. Temp Mail Inbox Reader
    else if (cmd === "checkmail") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "ejemplo@domain.com"));
      const email = args[0];
      const parts = email.split("@");
      if (parts.length !== 2) return m.reply("⚠️ Formato de email temporal inválido.");

      const login = parts[0];
      const domain = parts[1];

      try {
        const res = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`);
        if (res.ok) {
          const messages = await res.json();
          if (messages.length === 0) {
            await m.reply(`*📬 BANDEJA DE ENTRADA (${email})*\n\nNo se han recibido mensajes en este correo aún. Intenta de nuevo en unos momentos.`);
          } else {
            let inboxMsg = `*📬 MENSAJES RECIBIDOS (${email})*\n\n*Mensajes totales:* ${messages.length}\n\n`;
            for (let i = 0; i < Math.min(messages.length, 5); i++) {
              const msg = messages[i];
              // Fetch full body
              const detailRes = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`);
              let bodyText = "";
              if (detailRes.ok) {
                const detail = await detailRes.json();
                bodyText = detail.textBody || detail.body || "";
              }
              inboxMsg += `*#${i + 1} De:* ${msg.from}\n*Asunto:* ${msg.subject}\n*Fecha:* ${msg.date}\n*Cuerpo:*\n${bodyText.slice(0, 300)}${bodyText.length > 300 ? "..." : ""}\n───────────────────\n`;
            }
            await m.reply(inboxMsg);
          }
        } else {
          throw new Error("Failed to contact mailbox reader service");
        }
      } catch (e) {
        await m.reply(`⚠️ Error leyendo correo temporal: ${e.message}`);
      }
    }
  }
};
