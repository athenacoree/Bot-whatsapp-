module.exports = {
  help: ["qr", "shorten", "translate", "wikipedia", "weather", "crypto"],
  tags: ["tools"],
  command: /^(qr|shorten|translate|wikipedia|weather|crypto)$/i,
  run: async (m, { conn, command, args, Func }) => {
    const cmd = command.toLowerCase();

    // 1. QR Code Generator
    if (cmd === "qr") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "https://google.com"));
      const text = args.join(" ");
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
      await conn.sendMessage(m.chat, { image: { url: qrUrl }, caption: `*📷 CÓDIGO QR GENERADO*\n\n*Contenido:* ${text}` }, { quoted: m });
    }

    // 2. Link Shortener
    else if (cmd === "shorten") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "https://example.com/very/long/url"));
      const urlToShorten = args[0];
      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(urlToShorten)}`);
        if (res.ok) {
          const shortUrl = await res.text();
          await m.reply(`*🔗 ACORTADOR DE ENLACES*\n\n*Original:* ${urlToShorten}\n*Corto:* ${shortUrl}`);
        } else {
          throw new Error("TinyURL service error");
        }
      } catch (e) {
        await m.reply(`⚠️ No se pudo acortar el enlace. Error: ${e.message}`);
      }
    }

    // 3. Translator
    else if (cmd === "translate") {
      if (args.length < 2) return m.reply(Func.example(m.prefix, command, "en hola como estas"));
      const targetLang = args[0];
      const textToTranslate = args.slice(1).join(" ");
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`);
        if (res.ok) {
          const json = await res.json();
          const translatedText = json[0].map(item => item[0]).join("");
          await m.reply(`*🌐 TRADUCTOR MULTILINGÜE*\n\n*Idioma Destino:* ${targetLang.toUpperCase()}\n*Original:* ${textToTranslate}\n*Traducción:* ${translatedText}`);
        } else {
          throw new Error("Google Translate API error");
        }
      } catch (e) {
        await m.reply(`⚠️ Error en la traducción: ${e.message}`);
      }
    }

    // 4. Wikipedia Search
    else if (cmd === "wikipedia") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "WhatsApp"));
      const query = args.join(" ");
      try {
        const res = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.type === "standard") {
            const wikiMsg = `*📚 WIKIPEDIA (BÚSQUEDA)*\n\n*Título:* ${data.title}\n\n*Extracto:* ${data.extract}\n\n*Enlace completo:* ${data.content_urls.desktop.page}`;
            await m.reply(wikiMsg);
          } else {
            await m.reply(`⚠️ No se encontró una página estándar para: "${query}".`);
          }
        } else {
          await m.reply(`⚠️ No se encontraron resultados en Wikipedia para "${query}".`);
        }
      } catch (e) {
        await m.reply(`⚠️ Error buscando en Wikipedia: ${e.message}`);
      }
    }

    // 5. Weather
    else if (cmd === "weather") {
      if (!args[0]) return m.reply(Func.example(m.prefix, command, "Bogota"));
      const city = args.join(" ");
      try {
        // Using open-meteo free geocoding and weather APIs (completely key-less!)
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results[0]) {
            const loc = geoData.results[0];
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true`);
            if (weatherRes.ok) {
              const wData = await weatherRes.json();
              const curr = wData.current_weather;
              const weatherMsg = `*☀️ CLIMA Y TIEMPO*\n\n*Ciudad:* ${loc.name} (${loc.country})\n*Coordenadas:* ${loc.latitude.toFixed(2)}, ${loc.longitude.toFixed(2)}\n\n*Temperatura:* ${curr.temperature}°C\n*Velocidad del viento:* ${curr.windspeed} km/h\n*Código de clima:* ${curr.weathercode}`;
              await m.reply(weatherMsg);
            } else {
              throw new Error("Weather forecast service failed");
            }
          } else {
            await m.reply(`⚠️ No se encontró la localización de "${city}".`);
          }
        } else {
          throw new Error("Geocoding service failed");
        }
      } catch (e) {
        await m.reply(`⚠️ Error al buscar clima: ${e.message}`);
      }
    }

    // 6. Crypto Price Checker
    else if (cmd === "crypto") {
      const symbol = args[0] ? args[0].toUpperCase() : "BTC";
      try {
        // Free CoinGecko or Coinbase simple API (fully key-less!)
        const res = await fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`);
        if (res.ok) {
          const data = await res.json();
          if (data.data && data.data.amount) {
            const price = parseFloat(data.data.amount).toLocaleString("en-US", { style: "currency", currency: "USD" });
            await m.reply(`*🪙 PRECIO CRIPTOMONEDAS*\n\n*Par:* ${symbol} / USD\n*Precio Actual:* ${price}\n*Plataforma:* Coinbase Spot`);
          } else {
            await m.reply(`⚠️ Criptomoneda "${symbol}" no soportada o inválida.`);
          }
        } else {
          await m.reply(`⚠️ No se pudo obtener el precio de "${symbol}".`);
        }
      } catch (e) {
        await m.reply(`⚠️ Error buscando criptomoneda: ${e.message}`);
      }
    }
  }
};
