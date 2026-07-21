# <div align="center">YOSHIDA-BOT</div>

<div align="center">
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp">
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/JSON-000000?style=for-the-badge&logo=json&logoColor=white" alt="JSON">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License">
</div>

<div align="center">
  <h3>Lightweight & Powerful WhatsApp Bot</h3>
  <p><em>Built with Baileys • Powered by Yoshida-APIs • Completely Free</em></p>
</div>

---

## ✨ **Why Choose Yoshida-Bot?**

<table>
<tr>
<td>🆓 <strong>100% Free</strong></td>
<td>No hidden costs, completely open-source</td>
</tr>
<tr>
<td>🔌 <strong>Plug & Play</strong></td>
<td>Modular architecture for easy customization</td>
</tr>
<tr>
<td>⚡ <strong>Lightning Fast</strong></td>
<td>Built on Baileys for optimal performance</td>
</tr>
<tr>
<td>💾 <strong>Hybrid Storage</strong></td>
<td>PostgreSQL + JSON for optimal performance</td>
</tr>
<tr>
<td>🛡️ <strong>Reliable</strong></td>
<td>Stable connection with advanced error handling</td>
</tr>
<tr>
<td>🎯 <strong>Easy Deploy</strong></td>
<td>Multiple deployment options available</td>
</tr>
</table>

---

## 🏗️ **Architecture Overview**

```
📦 yoshida-bot/
├── 📁 library/           # Core logic & helper modules
├── 📁 plugins/           # Command-based plugin modules
├── 📁 system/            # Internal system logic
├── 📁 sessions/          # WhatsApp session files (JSON)
├── 📁 database/          # Local database files (JSON)
├── 📄 index.js           # Main application entry point
├── 📄 machine.js         # State management logic
├── ⚙️ ecosystem.config.js # PM2 deployment configuration
├── 🔐 .env               # Environment variables
└── 📋 package.json       # Project dependencies
```

---

## 📋 **Requirements**

### **System Requirements**

| Component   | Version        | Required    |
| ----------- | -------------- | ----------- |
| Node.js     | 16.x or higher | ✅          |
| npm/yarn    | Latest         | ✅          |
| Git         | Latest         | ✅          |
| FFmpeg      | Latest         | ✅          |
| ImageMagick | Latest         | ✅          |
| PostgreSQL  | 12.x or higher | ⚠️ Optional |

---

### **🟢 For Heroku Users**

**Required Buildpacks** (Add in this order):

```bash
# 1. Node.js buildpack
heroku buildpacks:add heroku/nodejs

# 2. Python buildpack
heroku buildpacks:add heroku/python

# 3. FFmpeg buildpack
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git

# 4. ImageMagick buildpack
heroku buildpacks:add https://github.com/DuckyTeam/heroku-buildpack-imagemagick.git
```

**Alternative using app.json:**

```json
{
	"buildpacks": [
		{ "url": "heroku/nodejs" },
		{ "url": "heroku/python" },
		{
			"url": "https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git"
		},
		{
			"url": "https://github.com/DuckyTeam/heroku-buildpack-imagemagick.git"
		}
	]
}
```

---

### **🟡 For Windows / RDP Users**

**Download and install the following software:**

| Software        | Download Link                                                | Purpose                   |
| --------------- | ------------------------------------------------------------ | ------------------------- |
| **Git**         | [Download here](https://git-scm.com/downloads)               | Version control & cloning |
| **Node.js**     | [Download here](https://nodejs.org/en/download)              | JavaScript runtime        |
| **FFmpeg**      | [Download here](https://ffmpeg.org/download.html)            | Media processing          |
| **ImageMagick** | [Download here](https://imagemagick.org/script/download.php) | Image processing          |

**Installation Steps:**

1. **Install Git**
    - Download Git from the official website
    - Run the installer with default settings
    - Verify: `git --version`

2. **Install Node.js**
    - Download LTS version from nodejs.org
    - Run the installer (includes npm)
    - Verify: `node --version` and `npm --version`

3. **Install FFmpeg**
    - Download the Windows build
    - Extract to `C:\ffmpeg\`
    - Add `C:\ffmpeg\bin` to your system PATH
    - Verify: `ffmpeg -version`

4. **Install ImageMagick**
    - Download Windows installer
    - Run with default settings
    - Verify: `magick -version`

---

### **🟠 For Linux/VPS Users**

**Ubuntu/Debian:**

```bash
# Update package list
sudo apt update

# Install required packages
sudo apt install -y git nodejs npm ffmpeg imagemagick

# Verify installations
node --version
npm --version
ffmpeg -version
convert -version
```

**CentOS/RHEL:**

```bash
# Install NodeJS
curl -sL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs

# Install other packages
sudo yum install -y git ffmpeg ImageMagick

# Verify installations
node --version
npm --version
ffmpeg -version
convert -version
```

---

## 🚀 **Quick Start Guide**

### 1️⃣ **Installation**

```bash
# Clone the repository
git clone https://github.com/yuurahz/yoshida.git

# Navigate to project directory
cd yoshida

# Install dependencies
npm install
```

### 2️⃣ **Configuration**

Create a `.env` file in the root directory:

```env
# Time Zone Configuration
TZ=Asia/Jakarta

# Pairing Configuration
PAIRING_STATE=true
PAIRING_NUMBER= (e.g 628xxx)

#setup
DATABASE_NAME= /** local or postgres (default local) */
DATABASE_STATE=
SESSION_NAME=
SESSION_TYPE= /** local or postgres (default local) */

#postgresql config (visit here: https://console.aiven.io)[recommended]
POSTGRES_HOST=
POSTGRES_PASSWORD=
POSTGRES_USER=
POSTGRES_DATABASE=
POSTGRES_PORT=
POSTGRES_SSL=""
```

### 3️⃣ **Launch Your Bot**

Choose your preferred method:

```bash
# Development Mode
npm start

# Production Mode with PM2
npm run pm2

# Manual PM2 Setup
pm2 start ecosystem.config.js
```

---

## 🔧 **Plugin Development**

### **Creating a Basic Plugin**

```javascript
module.exports = {
	// Plugin metadata
	help: ["ping", "test"],
	tags: ["tools"],
	command: /^(ping|test)$/i,

	// Main plugin logic
	run: async (m, { conn }) => {
		try {
			const startTime = Date.now();
			await conn.reply(m.chat, "🏓 Pong!", m);
			const endTime = Date.now();

			await conn.reply(
				m.chat,
				`⚡ Response time: ${endTime - startTime}ms`,
				m
			);
		} catch (error) {
			return conn.reply(m.chat, `❌ Error: ${error.message}`, m);
		}
	},

	// Plugin permissions
	group: false, // Works in groups
	admin: false, // Requires admin
	limit: false, // Uses command limit
	premium: false, // Premium only
	botAdmin: false, // Bot needs admin
	owner: false, // Owner only
};
```

### **Creating Event Handlers**

```javascript
module.exports = {
	async before(m, { conn }) {
		try {
			// Pre-processing logic
			if (m.text && m.text.includes("hello")) {
				await conn.reply(m.chat, "👋 Hello there!", m);
			}
		} catch (error) {
			console.error("Event handler error:", error);
		}
		return true;
	},
};
```

---

### **PM2 Configuration**

```javascript
module.exports = {
	apps: [
		{
			name: "yoshida-bot",
			script: "./index.js",
			instances: 1,
			autorestart: true,
			watch: false,
			max_memory_restart: "1G",
			node_args: "--max-old-space-size=2048",
			env: {
				NODE_ENV: "production",
			},
			env_development: {
				NODE_ENV: "development",
			},
		},
	],
};
```

---

## 📊 **Storage & Database**

### **Multi-Storage Architecture**

Yoshida-Bot uses a **hybrid storage system** for optimal performance and reliability:

<table>
<tr>
<td>🗄️ <strong>PostgreSQL</strong></td>
<td>Primary database for persistent data</td>
</tr>
<tr>
<td>📁 <strong>JSON Local</strong></td>
<td>Local file storage for sessions & cache</td>
</tr>
</table>

### **Session Management**

```javascript
// Multiple session storage options
const postgreSQLConfig = {
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DATABASE,
    ssl: {
      rejectUnauthorized: true,
      ca: process.env.POSTGRES_SSL.replace(/"""/g, ""),
    },
  },

  // Local JSON
```

### **Database Configuration**

```javascript
// PostgreSQL connection example
const { Pool } = require("pg");

const pool = new Pool({
	user: process.env.POSTGRES_USER,
	host: process.env.POSTGRES_HOST,
	database: process.env.POSTGRES_DATABASE,
	password: process.env.POSTGRES_PASSWORD,
	port: process.env.POSTGRES_PORT,
	ssl: {
		rejectUnauthorized: true,
		ca: process.env.POSTGRES_SSL.replace(/"""/g, ""),
	},
});

// Local JSON storage
class Local {
	/**
	 * Initializes the LocalDB instance with the provided file path.
	 * @param {string} [filePath] - The path to the JSON file where the database will be stored. Defaults to 'database.json'.
	 */
	constructor(filePath) {
		this.filePath = filePath
			? filePath + ".json"
			: process.env.DATABASE_NAME;
		this.queue = [];
		this.initDB();
	}

	/**
	 * Initializes the database by checking if the file exists.
	 * If the file does not exist, it creates an empty JSON file.
	 * @returns {Promise<void>}
	 */
	initDB = async () => {
		try {
			await fs.access(this.filePath);
		} catch (err) {
			await this.write({});
		}
	};

	/**
	 * Validates if the provided data is a valid JSON object.
	 * @param {any} data - The data to be validated.
	 * @returns {boolean} - Returns true if the data is valid JSON, otherwise false.
	 */
	validateJSON = (data) => {
		try {
			JSON.stringify(data, null);
			return true;
		} catch (err) {
			return false;
		}
	};

	/**
	 * Adds data to the internal queue to be saved later.
	 * @param {object} data - The data to be added to the queue.
	 */
	enqueue = (data) => this.queue.push(data);

	/**
	 * Write the valid data from the queue to the file.
	 * If the data is valid JSON, it will be written to the file.
	 * @param {object} data - The data to be saved to the file.
	 * @returns {Promise<void>}
	 */
	write = async (data) => {
		this.enqueue(data);

		const validData = this.queue.filter(this.validateJSON);
		this.queue = [];

		if (validData.length > 0) {
			try {
				await fs.writeFile(
					this.filePath,
					JSON.stringify(validData[0], null),
					"utf8"
				);
			} catch (err) {
				console.log(`Failed to save data: ${err.message}`);
			}
		} else {
			console.log("No valid data to save");
		}
	};

	/**
	 * Read the data from the JSON file and returns it.
	 * @returns {Promise<object|null>} - The parsed data from the file, or null if an error occurred.
	 */
	read = async () => {
		try {
			const data = await fs.readFile(this.filePath, "utf8");
			return JSON.parse(data);
		} catch (err) {
			console.log(`Failed to fetch data: ${err.message}`);
			return null;
		}
	};
}
```

---

## 🤝 **Contributing**

We welcome contributions! Here's how you can help:

1. 🍴 **Fork** the repository
2. 🌟 **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. 💾 **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. 📤 **Push** to the branch (`git push origin feature/amazing-feature`)
5. 🔄 **Open** a Pull Request

---

## 📜 **License & Terms**

<div align="center">

**MIT License** - Free for personal and commercial use

⭐ **Please star this repository if you find it useful!**

</div>

### **Usage Guidelines**

- ✅ Free to use and modify
- ✅ Commercial use allowed
- ✅ Private use allowed
- ⚠️ Must include license and copyright notice
- ❌ No warranty provided

---

## 🏆 **Credits & Acknowledgements**

<div align="center">

| Role                 | Contributor  | Links                                            |
| -------------------- | ------------ | ------------------------------------------------ |
| **Developer**        | yuurahz      | [GitHub](https://github.com/yuurahz)             |
| **Library Provider** | @yoshx/func  | [npm](https://www.npmjs.com/package/@yoshx/func) |
| **API Provider**     | Yoshida-APIs | [Try it](https://api.yoshida.my.id)              |

</div>

---

## 🚨 **Incidentes y Resolución (Troubleshooting)**

### **Incidente de Autenticación WhatsApp (Error 401 tras Pairing)**

En sistemas de despliegue continuo como Render, puede ocurrir un rechazo silencioso de la sesión de WhatsApp (error 401 / desvinculación constante) debido a actualizaciones automáticas descontroladas de dependencias flotantes.

#### **Causa Raíz:**
1. La dependencia `"@whiskeysockets/baileys": "npm:baileys-mod"` en `package.json` no tenía una versión fija, forzando la instalación del último fork disponible en cada build.
2. El archivo `package-lock.json` estaba ignorado en `.gitignore`, impidiendo replicar una instalación idéntica entre entornos de desarrollo y producción.
3. El cambio del formato interno de las credenciales de sesión en la nueva versión provocó incompatibilidades con la base de datos Postgres (`postgres-baileys`), resultando en corrupción de sesión silenciosa.

#### **Solución Aplicada (Medidas Obligatorias):**
- **Versión Fija:** Se fijaron las versiones exactas en `package.json` para garantizar la estabilidad:
  - `"@whiskeysockets/baileys": "npm:baileys-mod@6.8.5"`
  - `"postgres-baileys": "1.5.0"`
- **Seguimiento del Lockfile:** Se eliminó `package-lock.*` de `.gitignore` y se subió el `package-lock.json` al repositorio para congelar el árbol de dependencias.
- **Log de Diagnóstico de Arranque:** Al iniciar, `machine.js` lee el `package.json` interno del módulo cargado y registra en consola la versión exacta instalada.
- **Limpieza de Sesión Remota:** Se añadió un endpoint seguro `/api/clean-session` y un botón **"Borrar Sesión WA"** en el Panel de Administración (bajo Ajustes Generales) para limpiar completamente la sesión en la base de datos PostgreSQL o almacenamiento local e iniciar un nuevo emparejamiento limpio.

---

### 🔄 **Procedimiento de Rollback / Verificación**

Si vuelves a experimentar desconexiones inexplicables tras una reinstalación:

1. **Verifica la versión cargada:**
   Revisa los logs de arranque en consola o el panel. Deberías ver:
   `[ STARTUP ] Real baileys-mod version loaded: X.Y.Z`

2. **Procedimiento de Rollback de Versión:**
   - Si una actualización de `baileys-mod` rompe la compatibilidad, edita `package.json` y fija una versión estable anterior conocida sin `^` ni `~` (ej: `npm:baileys-mod@6.8.5`).
   - Ejecuta localmente `npm install --legacy-peer-deps` para regenerar el `package-lock.json`.
   - Haz commit de ambos archivos (`package.json` y `package-lock.json`).

3. **Borrado Limpio de Sesión Corrupta:**
   - Ve a la pestaña **Ajustes Generales** en tu Panel Admin.
   - Haz clic en **Borrar Sesión WA**.
   - Esto eliminará las credenciales corruptas de la tabla `auth_data` en Postgres (o la carpeta de sesión local) y reiniciará automáticamente el bot para que puedas escanear el QR o solicitar un nuevo código de pairing limpio.

---

## 🚨 **Incidentes y Resolución Avanzados (Troubleshooting Pro)**

### **1. Bucle de Auto-Reporte de Errores y Riesgo de Baneo por Spam (PROBLEMA 1)**

#### **Causa Raíz:**
1. Los eventos de historias de WhatsApp (`status@broadcast`) eran capturados por el callback `messages.upsert` de `machine.js` y enviados a `@system/handler`.
2. Al carecer de prefijo de comando, se activaba la lógica de chat libre con la IA (`shouldTriggerAiFreeChat`).
3. El bot intentaba responder a este estado enviando un mensaje mediante `m.reply(response)` al JID `status@broadcast`.
4. Enviar un mensaje de chat tradicional a un canal de estado de WhatsApp no está soportado por Baileys/WhatsApp, lo que provocaba un fallo inmediato.
5. El bloque `catch` del manejador volvía a intentar responder a `status@broadcast` con el mensaje de error, fallando nuevamente de manera infinita.
6. Al no estar `await`eada ni contener un bloque `.catch()` externo en `machine.js`, la promesa devuelta se rechazaba silenciosamente generando un evento global `unhandledRejection`.
7. Este evento disparaba la función de notificación automática `global.reportErrorToAdmin(err)` a gran velocidad, enviando cientos de mensajes de error al administrador y provocando un bloqueo temporal del bot por spam por parte de WhatsApp (`rate-overlimit`).
8. Adicionalmente, el programador de tareas `cron.schedule` estaba ubicado dentro del callback del flujo de mensajes, por lo que con cada mensaje entrante se agendaba una nueva tarea repetida en memoria, causando un leak grave de recursos.

#### **Solución Aplicada:**
- **Cláusula de Guarda de Estado:** Se añadió `if (m.chat === "status@broadcast" || (m.key && m.key.remoteJid === "status@broadcast")) return;` al inicio de `system/handler.js` para ignorar inmediatamente cualquier evento de canal de estado.
- **Throttling en Reportes de Error:** Se implementó un control de frecuencia (throttling) en `global.reportErrorToAdmin` dentro de `machine.js` que limita el envío de informes al administrador a un máximo de **uno cada 5 minutos**. Las alertas adicionales se suprimen, se cuentan y se reporta la cantidad de avisos suprimidos en el siguiente informe activo.
- **Ubicación Correcta del Cron Job:** Se movió la definición del cron job de medianoche fuera del flujo de mensajes al ámbito de archivo (file-level scope) para que se registre exactamente una sola vez en el arranque, envolviendo su ejecución en un try-catch aislado para que nunca rompa el proceso.

---

### **2. Inactividad o Silencio Intermitente del Bot (PROBLEMA 2)**

#### **Causa Raíz:**
1. El pipeline de eventos `messages.upsert` en `machine.js` carecía de un bloque global de control de excepciones `try...catch`. Un solo error al procesar eventos rápidos (como la ausencia de `m.key.participant` al recibir ciertas historias que hacía fallar `conn.decodeJid()`) rechazaba la promesa del event listener, deteniendo inmediatamente la ejecución del bot para ese mensaje y congelando la conexión.
2. Las llamadas a los módulos `@system/case` y `@system/handler` no se gestionaban de manera síncrona ni se controlaban sus rechazos de promesa, cortando silenciosamente el flujo de ejecución antes de alcanzar el método de respuesta `conn.sendMessage` o `m.reply`.

#### **Solución Aplicada:**
- **Aislamiento de Pipeline:** Se envolvió todo el callback de `messages.upsert` en un bloque `try...catch` maestro de aislamiento.
- **Aislamiento e Invocación Síncrona de Módulos:** Se envolvieron las subtareas individuales (reacción a estados, procesamiento de comandos `case.js` y procesamiento de `handler.js`) en sus respectivos bloques `try...catch` independientes y se agregaron `await` explícitos en sus llamadas para controlar los rechazos de promesas. Esto garantiza que un fallo en una reacción de estado o en un comando no afecte el flujo normal de las demás conversaciones de los usuarios.
- **Robustez de JID:** Se añadieron fallbacks seguros (`m.key.participant || m.sender`) al invocar `conn.decodeJid` para evitar excepciones por campos nulos.

---

### **🛠️ 20 Nuevas Herramientas y Comandos Agregados**

Se han incorporado **20 herramientas funcionales, de búsqueda y entretenimiento** totalmente libres de API keys y listas para usar, organizadas en plugins modulares bajo `plugins/tools/`:

#### **📐 Matemáticas y Codificación (`math_utils.js`)**
1. 🧮 `calc <expresión>`: Evalúa expresiones matemáticas de forma segura (ej: `.calc 5 + 5 * 2`).
2. 🎲 `dice`/`roll`: Lanza un dado tradicional de 6 caras con emojis divertidos.
3. 🪙 `flip`/`coin`: Lanza una moneda al aire (Cara o Cruz).
4. 💖 `love <nombre/usuario>`: Calcula la compatibilidad amorosa entre tú y otra persona con veredictos humorísticos.
5. 🔗 `b64encode <texto>`: Convierte un texto plano a formato codificado en Base64.
6. 🔓 `b64decode <base64>`: Decodifica un string en formato Base64 a texto plano legible.

#### **🌐 Herramientas Web e Información (`web_utils.js`)**
7. 📷 `qr <texto/enlace>`: Genera un código QR en imagen de manera instantánea.
8. 🔗 `shorten <enlace>`: Acorta enlaces URL muy largos utilizando la API gratuita de TinyURL.
9. 🌐 `translate <idioma> <texto>`: Traduce texto a cualquier idioma destino soportado por Google Translate (ej: `.translate en hola mundo`).
10. 📚 `wikipedia <búsqueda>`: Obtiene un resumen directo de Wikipedia en español para cualquier término.
11. ☀️ `weather <ciudad>`: Consulta el estado del clima en tiempo real, temperatura y velocidad del viento sin requerir llaves de API externas.
12. 🪙 `crypto <símbolo>`: Obtiene la cotización en dólares del mercado spot para Bitcoin (BTC), Ethereum (ETH), Solana (SOL) y más.

#### **📬 Correos Temporales (`mail_utils.js`)**
13. 📨 `tempmail`: Genera un buzón de correo electrónico temporal aleatorio de 10 minutos para registros anónimos.
14. 📬 `checkmail <correo>`: Consulta la bandeja de entrada y lee los últimos 5 mensajes recibidos en tu correo temporal de forma directa.

#### **😜 Entretenimiento y Chistes (`fun_utils.js`)**
15. 😜 `joke`/`chiste`: Devuelve chistes ingeniosos en español para divertirse en los chats.
16. ✨ `quote`/`frase`: Muestra citas e ideas célebres e inspiradoras de personajes famosos.

#### **📢 Utilidades de Grupo (`group_utils.js`)**
17. 📢 `tagall <mensaje>`: Etiqueta y menciona de manera visible a todos los miembros de un grupo (Solo para Administradores).
18. 🕵️‍♂️ `hidetag <mensaje>`: Envía un mensaje que menciona a todos los miembros de forma oculta en el fondo (Solo para Administradores).

#### **🏓 Utilidades del Sistema (`sys_utils.js`)**
19. 🏓 `ping`: Mide la latencia de respuesta y velocidad exacta del bot en milisegundos.
20. 💱 `currency <monto> <desde> <hacia>`: Conversor de divisas mundial en tiempo real (ej: `.currency 100 USD EUR`) con tasas de cambio actualizadas.

---

## 🆘 **Support & Community**

<div align="center">

[![GitHub Issues](https://img.shields.io/github/issues/yuurahz/yoshida?style=for-the-badge)](https://github.com/yuurahz/yoshida/issues)
[![GitHub Stars](https://img.shields.io/github/stars/yuurahz/yoshida?style=for-the-badge)](https://github.com/yuurahz/yoshida/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yuurahz/yoshida?style=for-the-badge)](https://github.com/yuurahz/yoshida/network/members)

**Need help?** Open an issue or join our community discussions!

</div>

<div align="center">

**Made with ❤️ by the Yoshida-Bot Team**

_Building the future of WhatsApp automation_

</div>
