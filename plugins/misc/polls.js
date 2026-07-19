module.exports = {
  help: ["poll Pregunta | Opción 1 | Opción 2", "pollresults [id]", "vote [id] | [opción]"],
  tags: ["misc"],
  command: /^(poll|encuesta|pollresults|vote|voto)$/i,
  run: async (m, { conn, Func }) => {
    try {
      if (!global.db.polls) global.db.polls = {};

      const [cmd, ...args] = m.body.slice(1).trim().split(" ");
      const command = cmd.toLowerCase();

      if (command === "poll" || command === "encuesta") {
        const text = args.join(" ");
        if (!text || !text.includes("|")) {
          return m.reply("Uso incorrecto del comando.\n\nFormato:\n`.poll Pregunta | Opción 1 | Opción 2`\n\nEjemplo:\n`.poll ¿Qué tal el servicio de Yoshida? | Excelente | Bueno | Regular`");
        }

        const parts = text.split("|");
        const question = parts[0].trim();
        const options = parts.slice(1).map(o => o.trim()).filter(Boolean);

        if (options.length < 2) {
          return m.reply("Debes ingresar al menos dos opciones para la encuesta.");
        }

        // Send native WhatsApp poll
        const sentPoll = await conn.sendMessage(m.chat, {
          poll: {
            name: question,
            values: options,
            selectableCount: 1
          }
        });

        const pollId = sentPoll.key.id;

        global.db.polls[pollId] = {
          id: pollId,
          question: question,
          options: options,
          votes: {}, // jid -> option index (0-based)
          createdAt: Date.now(),
          chat: m.chat
        };

        await global.conn?.db?.write?.(global.db);

        await m.reply(`📊 *ENCUESTA CREADA* 📊\n\n- *Pregunta:* ${question}\n- *Opciones:* ${options.map((o, idx) => `${idx + 1}. ${o}`).join(", ")}\n\n_Puedes votar usando los botones de la encuesta o respondiendo con:_\n\`.vote ${pollId} | [número de opción]\``);
      }

      else if (command === "vote" || command === "voto") {
        const bodyText = args.join(" ");
        if (!bodyText || !bodyText.includes("|")) {
          return m.reply("Uso incorrecto. Formato: `.vote [id_encuesta] | [número_opción]`");
        }

        const parts = bodyText.split("|");
        const pollId = parts[0].trim();
        const optionNum = parseInt(parts[1].trim());

        const poll = global.db.polls[pollId];
        if (!poll) {
          return m.reply("No se encontró ninguna encuesta activa con ese ID.");
        }

        if (isNaN(optionNum) || optionNum < 1 || optionNum > poll.options.length) {
          return m.reply(`Opción inválida. Elige un número del 1 al ${poll.options.length}.`);
        }

        const optionIndex = optionNum - 1;
        poll.votes[m.sender] = optionIndex;

        await global.conn?.db?.write?.(global.db);

        // Calculate results
        const results = {};
        poll.options.forEach((o, i) => results[i] = 0);
        Object.values(poll.votes).forEach(idx => {
          results[idx] = (results[idx] || 0) + 1;
        });

        const totalVotes = Object.keys(poll.votes).length;

        let resTxt = `📊 *VOTO REGISTRADO* 📊\n\n*Pregunta:* ${poll.question}\n\n`;
        poll.options.forEach((o, i) => {
          const count = results[i];
          const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
          resTxt += `◦  *${o}:* ${count} votos (${pct}%)\n`;
        });
        resTxt += `\n*Total de votos:* ${totalVotes}`;

        await m.reply(resTxt);
      }

      else if (command === "pollresults") {
        const pollId = args[0];
        if (!pollId) return m.reply("Por favor ingresa el ID de la encuesta.");

        const poll = global.db.polls[pollId];
        if (!poll) return m.reply("No se encontró la encuesta especificada.");

        const results = {};
        poll.options.forEach((o, i) => results[i] = 0);
        Object.values(poll.votes).forEach(idx => {
          results[idx] = (results[idx] || 0) + 1;
        });

        const totalVotes = Object.keys(poll.votes).length;

        let resTxt = `📊 *RESULTADOS DE ENCUESTA* 📊\n\n*Pregunta:* ${poll.question}\n\n`;
        poll.options.forEach((o, i) => {
          const count = results[i];
          const pct = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
          resTxt += `◦  *${o}:* ${count} votos (${pct}%)\n`;
        });
        resTxt += `\n*Total de votos:* ${totalVotes}`;

        await m.reply(resTxt);
      }

    } catch (e) {
      console.error(e);
      m.reply(`Error en el sistema de encuestas: ${e.message}`);
    }
  }
};
