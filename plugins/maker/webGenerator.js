const AdmZip = require("adm-zip");
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = {
  help: ["web [tema]"],
  tags: ["maker"],
  command: /^(web)$/i,
  before: async (m, { conn }) => {
    try {
      if (m.isBot || !m.body) return false;
      const text = m.body.trim();
      const match = text.match(/^quiero\s+una\s+web\s+de\s+(.+)$/i);
      if (match) {
        const tema = match[1];
        await handleWebGeneration(m, conn, tema);
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  },
  run: async (m, { conn }) => {
    const args = m.args;
    if (args.length === 0) {
      return m.reply("Por favor, especifica el tema de la web que deseas generar.\nEjemplo: `.web un portafolio de fotógrafo` o escribe `Quiero una web de un restaurante de pizza`.");
    }
    const tema = args.join(" ");
    await handleWebGeneration(m, conn, tema);
  }
};

async function handleWebGeneration(m, conn, tema) {
  try {
    await m.reply(`🤖 *PROCESANDO SOLICITUD* 🤖\n\nEstoy diseñando y programando tu sitio web sobre *"${tema}"* usando Inteligencia Artificial avanzada.\n\nPor favor, espera un momento...`);

    const aiConfig = global.db.aiConfig || {};
    const apiKey = aiConfig.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return m.reply("❌ Error: No se ha configurado la API Key de Google Gemini en el panel o en las variables de entorno.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Genera un diseño web completo y sumamente interactivo sobre el tema: "${tema}".
Debe ser una sola página HTML que contenga TODO el CSS moderno (dentro de <style> con efectos, animaciones, colores elegantes, tipografías profesionales, etc.) y TODO el JS (dentro de <script> para hacerlo interactivo, efectos al hacer scroll, animaciones, etc.).
No utilices imágenes externas rotas; en su lugar, utiliza placeholders atractivos o iconos de FontAwesome e imágenes de Unsplash.
El diseño debe ser completamente responsivo (compatible con móviles, tablets y computadoras) con una estructura moderna de secciones (Hero, Quiénes Somos, Servicios/Características, Galería interactiva, Formulario de contacto funcional, Footer).
Entrega ÚNICAMENTE el código HTML completo encerrado entre bloques de código \`\`\`html y \`\`\`. No incluyas explicaciones adicionales, solo el bloque de código.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const codeMatch = text.match(/```html([\s\S]*?)```/);
    let htmlCode = "";
    if (codeMatch) {
      htmlCode = codeMatch[1].trim();
    } else {
      // Fallback
      htmlCode = text.trim();
    }

    if (!htmlCode.startsWith("<html") && !htmlCode.startsWith("<!DOCTYPE")) {
      htmlCode = "<!DOCTYPE html>\n" + htmlCode;
    }

    // Generate web ID
    const webId = "web_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    if (!global.db.generatedWebs) global.db.generatedWebs = {};
    global.db.generatedWebs[webId] = {
      id: webId,
      tema: tema,
      html: htmlCode,
      createdAt: Date.now(),
      createdBy: m.sender
    };

    // Save DB
    await global.conn?.db?.write?.(global.db);

    const externalUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`;
    const webLink = `${externalUrl}/web/${webId}`;

    // Create Zip in-memory
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from(htmlCode, "utf8"));

    // Extracted separate styled files for completeness
    const cssStyleMatch = htmlCode.match(/<style>([\s\S]*?)<\/style>/);
    const jsScriptMatch = htmlCode.match(/<script>([\s\S]*?)<\/script>/);

    const cssCode = cssStyleMatch ? cssStyleMatch[1].trim() : "/* No custom external CSS */";
    const jsCode = jsScriptMatch ? jsScriptMatch[1].trim() : "// No custom external JS";

    zip.addFile("style.css", Buffer.from(cssCode, "utf8"));
    zip.addFile("script.js", Buffer.from(jsCode, "utf8"));

    const zipBuffer = zip.toBuffer();

    let replyMsg = `✨ *WEB GENERADA CON ÉXITO* ✨\n\n`;
    replyMsg += `◦  *Tema:* ${tema}\n`;
    replyMsg += `◦  *URL en vivo:* ${webLink}\n`;
    replyMsg += `◦  *ID del sitio:* ${webId}\n\n`;
    replyMsg += `A continuación te enviaré el código fuente en formato ZIP y una captura de pantalla del sitio web generado.`;

    await m.reply(replyMsg);

    // Send ZIP Document
    await conn.sendMessage(m.chat, {
      document: zipBuffer,
      fileName: `web_${tema.toLowerCase().replace(/[^a-z0-9]/g, "_")}.zip`,
      mimetype: "application/zip",
      caption: `📦 *Código fuente completo (ZIP)* para la web de: ${tema}`
    }, { quoted: m });

    // Send Screenshot (using thum.io or microlink)
    try {
      const screenshotUrl = `https://image.thum.io/get/width/1280/crop/800/${webLink}`;
      await conn.sendMessage(m.chat, {
        image: { url: screenshotUrl },
        caption: `📸 *Captura de pantalla en vivo* del sitio generado:\n${webLink}`
      }, { quoted: m });
    } catch (err) {
      console.error("Failed to fetch screenshot:", err);
    }

  } catch (error) {
    console.error("Error generating website:", error);
    m.reply(`❌ Ocurrió un error al generar la página web: ${error.message}`);
  }
}
