module.exports = {
  help: ["calc", "dice", "roll", "flip", "coin", "love", "b64encode", "b64decode"],
  tags: ["tools"],
  command: /^(calc|dice|roll|flip|coin|love|b64encode|b64decode)$/i,
  run: async (m, { conn, command, args, Func }) => {
    const cmd = command.toLowerCase();

    // 1. Calculator
    if (cmd === "calc") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "2 + 2 * 5"));
      const expression = args.join(" ");
      // Safe math evaluation regex restriction (only numbers and basic math operators)
      if (/[^0-9+\-*/().\s]/g.test(expression)) {
        return m.reply("⚠️ Expresión matemática inválida o no permitida.");
      }
      try {
        const result = Function(`"use strict"; return (${expression})`)();
        await m.reply(`*📊 CALCULADORA*\n\n*Operación:* ${expression}\n*Resultado:* ${result}`);
      } catch (e) {
        await m.reply("⚠️ Error al evaluar la expresión matemática.");
      }
    }

    // 2. Dice
    else if (cmd === "dice" || cmd === "roll") {
      const sides = 6;
      const result = Math.floor(Math.random() * sides) + 1;
      const diceEmojis = ["🎲 ⚀", "🎲 ⚁", "🎲 ⚂", "🎲 ⚃", "🎲 ⚄", "🎲 ⚅"];
      await m.reply(`*🎲 LANZAR DADO*\n\n¡Has lanzado el dado y obtuviste un *${result}*!\n\n${diceEmojis[result - 1]}`);
    }

    // 3. Coin flip
    else if (cmd === "flip" || cmd === "coin") {
      const result = Math.random() < 0.5 ? "CARA" : "CRUZ";
      const coinEmoji = result === "CARA" ? "🪙👨" : "🪙🦅";
      await m.reply(`*🪙 LANZAR MONEDA*\n\n¡La moneda gira en el aire y cae en...\n\n*✨ ${result} ✨* ${coinEmoji}`);
    }

    // 4. Love Calculator
    else if (cmd === "love") {
      let targetName = "";
      if (m.mentionedJid && m.mentionedJid[0]) {
        targetName = `@${m.mentionedJid[0].split("@")[0]}`;
      } else if (args[0]) {
        targetName = args.join(" ");
      } else {
        return m.reply(Func.example(m.prefix, command, "@usuario"));
      }

      const senderName = m.name || m.sender.split("@")[0];
      const percentage = Math.floor(Math.random() * 101);

      let verdict = "";
      if (percentage < 30) verdict = "💔 Quizás es mejor ser solo amigos.";
      else if (percentage < 60) verdict = "⚡ Hay una chispa, ¡pero requiere esfuerzo!";
      else if (percentage < 85) verdict = "💖 ¡Gran conexión! Hay un romance potencial real.";
      else verdict = "💞 ¡Amor verdadero! Son almas gemelas perfectas.";

      const loveMsg = `*💖 CALCULADORA DE AMOR 💖*\n\n*Persona 1:* ${senderName}\n*Persona 2:* ${targetName}\n\n*Porcentaje de Compatibilidad:* [ *${percentage}%* ]\n\n*Veredicto:* ${verdict}`;
      await conn.sendMessage(m.chat, { text: loveMsg, mentions: m.mentionedJid }, { quoted: m });
    }

    // 5. Base64 Encode
    else if (cmd === "b64encode") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "hola mundo"));
      const text = args.join(" ");
      const encoded = Buffer.from(text, "utf8").toString("base64");
      await m.reply(`*🔗 CODIFICADOR BASE64*\n\n*Texto Original:* ${text}\n*Base64 Result:* \`\`\`${encoded}\`\`\``);
    }

    // 6. Base64 Decode
    else if (cmd === "b64decode") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "aG9sYSBtdW5kbw=="));
      const b64 = args.join(" ");
      try {
        const decoded = Buffer.from(b64, "base64").toString("utf8");
        await m.reply(`*🔓 DECODIFICADOR BASE64*\n\n*Base64:* ${b64}\n*Texto Decodificado:* ${decoded}`);
      } catch (e) {
        await m.reply("⚠️ Error al decodificar Base64. Asegúrate de que el formato sea válido.");
      }
    }
  }
};
