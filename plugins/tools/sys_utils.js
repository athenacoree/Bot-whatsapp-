module.exports = {
  help: ["ping", "currency"],
  tags: ["tools"],
  command: /^(ping|currency)$/i,
  run: async (m, { command, args, Func }) => {
    const cmd = command.toLowerCase();

    // 1. Latency Ping
    if (cmd === "ping") {
      const startTime = Date.now();
      await m.reply("⚡ Midiendo latencia...");
      const latency = Date.now() - startTime;
      await m.reply(`*🏓 PONG!*\n\n*Latencia:* ${latency} ms\n*Estado del proceso:* Activo y responde correctamente.`);
    }

    // 2. Currency Converter
    else if (cmd === "currency") {
      if (args.length < 3) return m.reply(Func.example(m.prefix, command, "100 USD EUR"));
      const amount = parseFloat(args[0]);
      if (isNaN(amount) || amount <= 0) return m.reply("⚠️ Ingresa una cantidad numérica válida.");

      const fromCurr = args[1].toUpperCase();
      const toCurr = args[2].toUpperCase();

      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${fromCurr}`);
        if (res.ok) {
          const data = await res.json();
          if (data.rates && data.rates[toCurr]) {
            const converted = (amount * data.rates[toCurr]).toFixed(2);
            await m.reply(`*💱 CONVERSOR DE DIVISAS*\n\n*Cantidad:* ${amount.toLocaleString()} ${fromCurr}\n*Equivale a:* ${parseFloat(converted).toLocaleString()} ${toCurr}\n\n*Tasa de cambio:* 1 ${fromCurr} = ${data.rates[toCurr].toFixed(4)} ${toCurr}\n*Última actualización:* ${data.time_last_update_utc}`);
          } else {
            await m.reply(`⚠️ Divisa "${toCurr}" no soportada o inexistente.`);
          }
        } else {
          await m.reply(`⚠️ No se pudieron obtener las tasas para la divisa "${fromCurr}".`);
        }
      } catch (e) {
        await m.reply(`⚠️ Error en la conversión de divisas: ${e.message}`);
      }
    }
  }
};
