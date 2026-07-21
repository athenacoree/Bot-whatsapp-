if (!globalThis.crypto) {
    globalThis.crypto = require("node:crypto").webcrypto;
}

(async () => {
    require("events").EventEmitter.defaultMaxListeners = 500;
	require("module-alias/register");
	require("@system/setting");
	const fs = require("node:fs");
	const pino = require("pino");
	const cron = require("node-cron");
	const { Boom } = require("@hapi/boom");
	const NodeCache = require("node-cache");
	const baileys = require("@whiskeysockets/baileys");

	let baileysVersion = "unknown";
	try {
		const baileysPkgPath = require.resolve("@whiskeysockets/baileys/package.json");
		const baileysPkg = JSON.parse(fs.readFileSync(baileysPkgPath, "utf-8"));
		baileysVersion = baileysPkg.version;
	} catch (e) {
		try {
			const pkg = require("@whiskeysockets/baileys/package.json");
			baileysVersion = pkg.version;
		} catch (err) {
			// fallback
		}
	}
	console.log(`[ STARTUP ] Real baileys-mod version loaded: ${baileysVersion}`);

	const QRCode = require("qrcode");
	const { loadPlugins, watchPlugins, plugins } = require("@system/plugins");
	const { Client, serialize } = require("@system/socket");
	const { Local, PostgreSQL } = require("@system/provider");
	const { usePostgreSQLAuthState } = require("postgres-baileys");

	/** [IMPLEMENTACION 15] Tiempo de arranque para uptime del panel */
	global.startTime = Date.now();
	global.connectedNumber = null;
	global.qrCodeDataURL = null;
	global.reconnectAttempts = 0;

	/** [IMPLEMENTACION 15] Validacion de variables de entorno al iniciar.
	 *  Evita crashes silenciosos a mitad de ejecucion (ej: REACT_STATUS vacio
	 *  tumbaba el bot en el primer status de un contacto). */
	function validateEnv() {
		const warnings = [];
		if (!process.env.REACT_STATUS) {
			warnings.push("REACT_STATUS no está definida. Se usará un set de emojis por defecto.");
		}
		if (process.env.SESSION_TYPE && /postgres/i.test(process.env.SESSION_TYPE)) {
			if (!process.env.DATABASE_URL && !(process.env.POSTGRES_HOST && process.env.POSTGRES_USER && process.env.POSTGRES_DATABASE)) {
				warnings.push("SESSION_TYPE=postgres pero no hay DATABASE_URL ni POSTGRES_HOST/USER/DATABASE completos. La sesión caerá a almacenamiento local.");
			}
		}
		if (process.env.PAIRING_STATE === "true" && !process.env.PAIRING_NUMBER) {
			warnings.push("PAIRING_STATE=true pero PAIRING_NUMBER está vacío.");
		}
		if (warnings.length) {
			console.log("\n[ ENV CHECK ] Se detectaron posibles problemas de configuración:");
			warnings.forEach((w) => console.log(`  ⚠️  ${w}`));
			console.log("");
		} else {
			console.log("[ ENV CHECK ] Variables de entorno OK.");
		}
	}
	validateEnv();

	/** [IMPLEMENTACION 13] Alerta por Webhook (Discord/Slack/genérico) ante eventos críticos.
	 *  Configura WEBHOOK_URL en tus variables de entorno para activarlo. */
	async function sendWebhookAlert(title, description) {
		if (!process.env.WEBHOOK_URL) return;
		try {
			await fetch(process.env.WEBHOOK_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: `**[YOSHIDA-BOT] ${title}**\n${description}`,
					event: title,
					message: description,
					timestamp: new Date().toISOString(),
				}),
			});
		} catch (e) {
			console.error("[ WEBHOOK ] No se pudo enviar la alerta:", e.message);
		}
	}
	global.sendWebhookAlert = sendWebhookAlert;

	/** [IMPLEMENTACION 12] Registro de eventos del sistema (no confundir con logs de chat).
	 *  Visible desde el panel en la pestaña Sistema. */
	function pushSystemLog(level, message) {
		if (!global.db.systemLogs) global.db.systemLogs = [];
		global.db.systemLogs.unshift({ level, message, timestamp: Date.now() });
		if (global.db.systemLogs.length > 200) global.db.systemLogs.length = 200;
	}
	global.pushSystemLog = pushSystemLog;

	/** postgreSQL cfg */
	let postgreSQLConfig = {
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		host: process.env.POSTGRES_HOST,
		port: parseInt(process.env.POSTGRES_PORT || "5432"),
		database: process.env.POSTGRES_DATABASE,
	};

	if (process.env.DATABASE_URL) {
		try {
			const { URL } = require("url");
			const parsed = new URL(process.env.DATABASE_URL);
			postgreSQLConfig = {
				user: parsed.username,
				password: decodeURIComponent(parsed.password || ""),
				host: parsed.hostname,
				port: parseInt(parsed.port || "5432"),
				database: parsed.pathname.replace(/^\//, ""),
				ssl: {
					rejectUnauthorized: false,
				},
			};
			console.log("[ DATABASE ] Loaded connection config from DATABASE_URL");
		} catch (e) {
			console.error("[ DATABASE ] Failed to parse DATABASE_URL:", e);
		}
	}

	const dbState = process.env.DATABASE_STATE || (process.env.DATABASE_URL ? "postgres" : "json");

	/** database options */
	const mydb = /json/i.test(dbState)
		? new Local()
		: new PostgreSQL(postgreSQLConfig, "db_bot");

	/** database init */
	global.db = await mydb.read();
	if (!global.db || Object.keys(global.db).length === 0) {
		global.db = {
			users: {},
			groups: {},
			chats: {},
			setting: {},
			stats: {},
		};
	}

	// Ensure all standard and admin config structures are fully initialized in-memory on start
	if (!global.db.users) global.db.users = {};
	if (!global.db.groups) global.db.groups = {};
	if (!global.db.chats) global.db.chats = {};
	if (!global.db.setting) global.db.setting = {};
	if (!global.db.stats) global.db.stats = {};

	if (!global.db.aiConfig || typeof global.db.aiConfig !== "object") {
		global.db.aiConfig = {
			personality: "Eres Yoshida, una asistente sarcástica, divertida y amigable.",
			tone: "amigable",
			language: "es",
			maxLength: 450,
			creativity: 0.7,
			provider: "gemini",
			apiKey: "",
			model: "gemini-2.0-flash",
			mcpEnabled: false,
			mcpServers: []
		};
	} else {
		// Optimize default maxLength if it was set to the old high default of 1000
		if (global.db.aiConfig.maxLength === 1000 || !global.db.aiConfig.maxLength) {
			global.db.aiConfig.maxLength = 450;
		}
	}

	if (!global.db.aiRules || !Array.isArray(global.db.aiRules)) {
		global.db.aiRules = [
			{ id: "1", text: "No des información personal", priority: "alta" },
			{ id: "2", text: "Siempre responde en español", priority: "alta" }
		];
	}

	if (!global.db.proactiveContacts || !Array.isArray(global.db.proactiveContacts)) {
		global.db.proactiveContacts = [];
	}

	if (!global.db.recentLogs || !Array.isArray(global.db.recentLogs)) {
		global.db.recentLogs = [];
	}

	if (!global.db.systemLogs || !Array.isArray(global.db.systemLogs)) {
		global.db.systemLogs = [];
	}

	if (!global.db.setting.disabledPlugins || !Array.isArray(global.db.setting.disabledPlugins)) {
		global.db.setting.disabledPlugins = [];
	}

	if (global.db.setting.pairingCodeRequested === undefined) {
		global.db.setting.pairingCodeRequested = false;
	}
	if (!global.db.setting.statusReactWhitelist) {
		global.db.setting.statusReactWhitelist = [];
	}

	await mydb.write(global.db);
	console.log("[ DATABASE ] Database fully initialized and loaded.");

	const logger = await pino({
		timestamp: () => `,"time":"${new Date().toJSON()}"`,
	}).child({ class: "conn" });
	logger.level = "silent";

	/** Session State Configuration Function */
	const getSessionState = async () => {
		const sessionType = process.env.SESSION_TYPE;

		if (
			sessionType.toLowerCase() === "postgresql" ||
			sessionType.toLowerCase() === "postgres"
		) {
			console.log("[ SESSION ] Using PostgreSQL session storage");

			try {
				const { state, saveCreds, deleteSession } =
					await usePostgreSQLAuthState(
						postgreSQLConfig,
						process.env.SESSION_NAME
					);

				return {
					type: "postgresql",
					state,
					saveCreds,
					deleteSession,
				};
			} catch (error) {
				console.log(
					"[ SESSION ] PostgreSQL connection failed, falling back to local storage"
				);
				console.error(error);
				return getLocalSessionState();
			}
		} else {
			return getLocalSessionState();
		}
	};

	/** Local Session State Function */
	const getLocalSessionState = async () => {
		console.log("[ SESSION ] Using local file session storage");

		const { state, saveCreds } = await baileys.useMultiFileAuthState(
			`./${process.env.SESSION_NAME}`
		);

		const deleteSession = async () => {
			try {
				const sessionPath = `./${process.env.SESSION_NAME}`;
				if (fs.existsSync(sessionPath)) {
					await fs.rmSync(sessionPath, {
						recursive: true,
						force: true,
					});
					console.log(
						"[ SESSION ] Local session deleted successfully"
					);
				}
			} catch (error) {
				console.error(
					"[ SESSION ] Error deleting local session:",
					error
				);
			}
		};

		return {
			type: "local",
			state,
			saveCreds,
			deleteSession,
		};
	};

	/** connect to websocket */
	const connectWA = async () => {
		const store = await baileys.makeInMemoryStore({
			logger,
		});

		const sessionConfig = await getSessionState();
		const { state, saveCreds, deleteSession } = sessionConfig;

		let version, isLatest;
		if (process.env.WA_VERSION_OVERRIDE) {
			try {
				version = process.env.WA_VERSION_OVERRIDE.split(".").map(v => parseInt(v, 10));
				isLatest = true;
				console.log(`[VERSION] Usando versión forzada mediante WA_VERSION_OVERRIDE: ${version.join(".")}`);
			} catch (err) {
				console.error("[VERSION] Error al parsear WA_VERSION_OVERRIDE, se ignorará:", err);
			}
		}

		if (!version) {
			if (typeof baileys.fetchLatestWaWebVersion === "function") {
				try {
					const latestVersion = await baileys.fetchLatestWaWebVersion();
					version = latestVersion.version;
					isLatest = latestVersion.isLatest;
					console.log(`[VERSION] Usando fetchLatestWaWebVersion: ${version.join(".")}, isLatest: ${isLatest}`);
				} catch (err) {
					console.error("[VERSION] Falló la llamada a fetchLatestWaWebVersion, usando versión fija de respaldo:", err);
					version = [2, 3000, 1043430842];
					isLatest = true;
					console.log(`[VERSION] Usando versión fija de respaldo: ${version.join(".")}`);
				}
			} else {
				version = [2, 3000, 1043430842];
				isLatest = true;
				console.log(`[VERSION] fetchLatestWaWebVersion no disponible. Usando versión fija de respaldo: ${version.join(".")}`);
			}
		}

		console.log(
			`-- Using WA v${version.join(".")}, isLatest: ${isLatest} --`
		);
		console.log(`-- Session Type: ${sessionConfig.type.toUpperCase()} --`);

		const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });

		const pairingState = (global.db.setting.pairingState !== undefined)
			? global.db.setting.pairingState
			: (process.env.PAIRING_STATE === "true" || process.env.PAIRING_STATE === true);

		const pairingNumber = global.db.setting.pairingNumber || process.env.PAIRING_NUMBER;

		const conn = await baileys.makeWASocket({
			version,
			logger,
			auth: {
				creds: state.creds,
				keys: baileys.makeCacheableSignalKeyStore(state.keys, logger),
			},
			printQRInTerminal: !pairingState,
			browser: baileys.Browsers.ubuntu("Edge"),
			markOnlineOnConnect: false,
			generateHighQualityLinkPreview: true,
			syncFullHistory: false,
			retryRequestDelayMs: 10,
			transactionOpts: {
				maxCommitRetries: 10,
				delayBetweenTriesMs: 10,
			},
			defaultQueryTimeoutMs: undefined,
			maxMsgRetryCount: 15,
			appStateMacVerification: {
				patch: true,
				snapshot: true,
			},
			cachedGroupMetadata: async (jid) => await groupCache.get(jid),
			shouldSyncHistoryMessage: (msg) => {
				console.log(`[+] Memuat Chat [${msg.progress}%]`);
				return !!msg.syncType;
			},
		});

		global.conn = conn; // Keep active connection globally accessible for the admin panel!

		/** [IMPLEMENTACION 10] Aplicar plugins deshabilitados desde el panel sin redeploy */
		const enforceDisabledPlugins = () => {
			const disabled = (global.db.setting && global.db.setting.disabledPlugins) || [];
			for (const name of disabled) {
				if (plugins[name]) delete plugins[name];
			}
		};
		enforceDisabledPlugins();
		setInterval(enforceDisabledPlugins, 5000);

		store.bind(conn.ev);
		await Client({ conn, store });

		if (conn.user && conn.user.id)
			conn.user.jid = await conn.decodeJid(conn.user.id);

		if (pairingState && !conn.authState.creds.registered) {
			if (global.db.setting.pairingCodeRequested === true) {
				try {
					const rawNumber = pairingNumber;
					if (!rawNumber) {
						console.warn("[SESSION] PAIRING_STATE is true, but PAIRING_NUMBER is empty or not defined. Please set PAIRING_NUMBER in your environment variables.");
						process.exit(0);
					}
					const phoneNumber = rawNumber.replace(/[^0-9]/g, "");
					if (!phoneNumber) {
						console.warn("[SESSION] PAIRING_NUMBER is invalid. Please set PAIRING_NUMBER to a valid phone number (e.g., 5491122334455).");
						process.exit(0);
					}
					await baileys.delay(3000);
					const code = await conn.requestPairingCode(
						phoneNumber,
						"YOSHIDA1"
					);
					const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
					global.pairingCode = formattedCode;
					console.log(
						`Pairing code: \x1b[32m${formattedCode}\x1b[39m`
					);

					// Reset pairingCodeRequested to false and save to database
					global.db.setting.pairingCodeRequested = false;
					await mydb.write(global.db);
				} catch (e) {
					console.error("[+] Gagal mendapatkan kode pairing", e);
					process.exit(0);
				}
			} else {
				console.log("[SESSION] No hay sesión activa. Esperando solicitud manual de código desde el panel de administración.");
			}
		}

		/** [IMPLEMENTACION 3] Reconexion con backoff exponencial (evita spamear a los
		 *  servidores de WhatsApp y reduce el riesgo de baneo por reconexiones agresivas) */
		const scheduledReconnect = async (label) => {
			global.reconnectAttempts = (global.reconnectAttempts || 0) + 1;
			const delayMs = Math.min(30000, 1000 * (2 ** global.reconnectAttempts));
			console.log(`[+] ${label}. Reintentando en ${(delayMs / 1000).toFixed(1)}s (intento ${global.reconnectAttempts})...`);
			pushSystemLog("warn", `${label}. Reintento #${global.reconnectAttempts} en ${(delayMs / 1000).toFixed(1)}s`);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
			await connectWA();
		};

		conn.ev.on("connection.update", async (update) => {
			const { lastDisconnect, connection, receivedPendingNotifications, qr } =
				update;

			/** [IMPLEMENTACION 1] Captura real del QR como imagen para el panel */
			if (qr) {
				try {
					global.qrCodeDataURL = await QRCode.toDataURL(qr);
					global.qrGeneratedAt = Date.now();
					console.log("[+] Nuevo QR generado, disponible en el panel de administración.");
				} catch (e) {
					console.error("[ QR ] Error generando imagen QR:", e.message);
				}
			}

			if (
				receivedPendingNotifications &&
				!conn.authState.creds?.myAppStateKeyId
			) {
				conn.ev.flush();
			}
			if (connection === "close") {
				let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
				switch (reason) {
					case 408:
						await scheduledReconnect("Connection timed out");
						break;
					case 503:
						await scheduledReconnect("Unavailable service");
						break;
					case 428:
						await scheduledReconnect("Connection closed");
						break;
					case 515:
						await scheduledReconnect("Need to restart");
						break;
					case 401:
						try {
							console.log(
								"[+] Session Logged Out.. Recreate session..."
							);
							pushSystemLog("error", "Sesión cerrada (401). Se eliminará la sesión.");
							await sendWebhookAlert("Sesión cerrada", "El bot se desconectó de WhatsApp (401) y se está eliminando la sesión.");
							// Ensure pairing code is not automatically requested upon restart
							global.db.setting.pairingCodeRequested = false;
							await mydb.write(global.db);
							await deleteSession();
							console.log("[+] Session removed!!");
							process.send("reset");
						} catch {
							console.log("[+] Session not found!!");
						}
						break;
					case 403:
						console.log(`[+] Your WhatsApp Has Been Baned :D`);
						pushSystemLog("critical", "El número fue baneado por WhatsApp (403).");
						await sendWebhookAlert("⚠️ Cuenta baneada", "WhatsApp ha bloqueado este número (403). Revisa el panel.");
						await deleteSession();
						process.exit();
						break;
					case 405:
						console.log("[+] Session Not Logged In (405). Keeping session and attempting reconnect with backoff...");
						pushSystemLog("warn", "Sesión no válida (405). No se borrará la sesión automáticamente. Intentando reconectar con backoff...");
						if (lastDisconnect?.error) {
							console.log("[+] 405 detailed error log:", JSON.stringify(lastDisconnect.error, null, 2));
							pushSystemLog("info", `Detalles error 405: ${lastDisconnect.error.message || lastDisconnect.error}`);
						}
						await scheduledReconnect("Conexión rechazada (405)");
						break;
					default:
						await scheduledReconnect(`Conexión cerrada (código ${reason || "desconocido"})`);
				}
			}
			if (connection === "open") {
				console.log("[+] Connected. . .");
				global.reconnectAttempts = 0;
				global.qrCodeDataURL = null;
				global.connectedAt = Date.now();
				global.connectedNumber = conn.user?.id ? conn.user.id.split(":")[0].split("@")[0] : null;
				pushSystemLog("info", `Conectado correctamente${global.connectedNumber ? " (" + global.connectedNumber + ")" : ""}.`);
			}
		});

		/** write session */
		conn.ev.on("creds.update", saveCreds);

		/** add contacts to store */
		conn.ev.on("contacts.update", (update) => {
			for (let contact of update) {
				let id = conn.decodeJid(contact.id);
				if (store && store.contacts)
					store.contacts[id] = {
						...(store.contacts?.[id] || {}),
						...(contact || {}),
					};
			}
		});

		/** add contact upsert to store */
		conn.ev.on("contacts.upsert", async (update) => {
			for (let contact of update) {
				let id = conn.decodeJid(contact.id);
				if (store && store.contacts)
					store.contacts[id] = {
						...(contact || {}),
						isContact: true,
					};
			}
		});

		/** update group changes to store */
		conn.ev.on("groups.update", async (updates) => {
			for (const update of updates) {
				const metadata = await conn.groupMetadata(update.id);
				groupCache.set(update.id, metadata);
				if (store.groupMetadata[update.id]) {
					store.groupMetadata[update.id] = {
						...(store.groupMetadata[update.id] || {}),
						...(update || {}),
					};
				}
			}
		});

		/** participants update with metadata and greetings */
		conn.ev.on(
			"group-participants.update",
			async ({ id, participants, action }) => {
				const group = db.groups[id] || {};
				const metadata = store.groupMetadata[id];
				groupCache.set(id, metadata);

				if (metadata) {
					switch (action) {
						case "add":
						case "revoked_membership_requests":
							metadata.participants.push(
								...participants.map((id) => ({
									id: baileys.jidNormalizedUser(id),
									admin: null,
								}))
							);
							break;
						case "demote":
						case "promote":
							for (const participant of metadata.participants) {
								let id = baileys.jidNormalizedUser(
									participant.id
								);
								if (participants.includes(id)) {
									participant.admin =
										action === "promote" ? "admin" : null;
								}
							}
							break;
						case "remove":
							metadata.participants =
								metadata.participants.filter(
									(p) =>
										!participants.includes(
											baileys.jidNormalizedUser(p.id)
										)
								);
							break;
					}
				}

				if (!db.setting.self_mode && group.welcome) {
					switch (action) {
						case "add":
						case "remove":
						case "leave":
						case "invite":
						case "invite_v4":
							let groupMetadata =
								(await store.groupMetadata[id]) ||
								(store.contacts[id] || {}).metadata;

							for (let user of participants) {
								let teks = (
									action === "add"
										? (
												group.sWelcome ||
												`Welcome @user (ʘᴗʘ���)\n${Func.readMore()}\n@desc`
											)
												.replace(
													"@subject",
													await conn.getName(id)
												)
												.replace(
													"@desc",
													groupMetadata.desc.toString()
												)
										: group.sBye ||
											"Sayonara @user (ー_ー゛)"
								).replace("@user", "@" + user.split("@")[0]);

								conn.reply(id, teks, null, {
									ephemeralExpiration:
										groupMetadata.ephemeralDuration,
								});
							}
							break;
					}
				}
			}
		);

		/** execute command */
		conn.ev.on("messages.update", async (updates) => {
			for (const update of updates) {
				if (update.pollUpdates && update.key) {
					const pollId = update.key.id;
					if (global.db.polls && global.db.polls[pollId]) {
						const poll = global.db.polls[pollId];
						// Standard Baileys poll-vote event handler
						const vote = update.pollUpdates[0];
						if (vote && vote.vote) {
							const voter = vote.votedBy || update.key.participant || update.sender;
							// If a vote option is selected, record it
							const selectedOptionHash = vote.vote.selectedOptions?.[0]?.name;
							if (selectedOptionHash) {
								// Match hash or index
								const idx = parseInt(selectedOptionHash);
								if (!isNaN(idx) && idx >= 0 && idx < poll.options.length) {
									poll.votes[voter] = idx;
								} else {
									const optIdx = poll.options.findIndex(opt => opt === selectedOptionHash);
									if (optIdx !== -1) {
										poll.votes[voter] = optIdx;
									}
								}
								await mydb.write(global.db);
								console.log(`[ POLL VOTE ] Native vote tracked for user ${voter} on poll ${pollId}`);
							}
						}
					}
				}
			}
		});

		conn.ev.on("messages.upsert", async ({ messages }) => {
			try {
				if (!messages[0].message) return;
				let m = await serialize(conn, messages[0], store);

				/** add metadata to store with cooldown and try-catch to prevent rate-overlimit errors */
				if (
					store.groupMetadata &&
					Object.keys(store.groupMetadata).length === 0 &&
					(!global.lastGroupFetchTime || Date.now() - global.lastGroupFetchTime > 10 * 60 * 1000)
				) {
					global.lastGroupFetchTime = Date.now();
					try {
						store.groupMetadata = await conn.groupFetchAllParticipating();
					} catch (fetchErr) {
						console.error("[GROUP FETCH ERROR] Error fetching participating groups:", fetchErr);
						if (global.pushSystemLog) {
							global.pushSystemLog("warn", `Error al obtener metadatos de grupos: ${fetchErr.message}`);
						}
					}
				}

				if (
					m.key &&
					!m.key.fromMe &&
					m.key.remoteJid === "status@broadcast"
				) {
					try {
						if (
							m.type === "protocolMessage" &&
							m.message.protocolMessage.type === 0
						)
							return;

						// Log received status story
						if (!global.db.receivedStatuses) global.db.receivedStatuses = [];
						const participant = conn.decodeJid(m.key.participant || m.sender);
						const statusText = m.body || m.type || "";
						global.db.receivedStatuses.unshift({
							id: m.id,
							key: m.key,
							participant: participant,
							text: statusText,
							timestamp: Date.now()
						});
						if (global.db.receivedStatuses.length > 50) {
							global.db.receivedStatuses = global.db.receivedStatuses.slice(0, 50);
						}

						// Check conditions:
						// 1. The contact has interacted before (users[participant].hit > 0)
						// 2. The contact is explicitly whitelisted (statusReactWhitelist.includes(participant))
						const userReg = global.db.users[participant];
						const hasInteracted = userReg && typeof userReg.hit === "number" && userReg.hit > 0;
						const isWhitelisted = global.db.setting.statusReactWhitelist && global.db.setting.statusReactWhitelist.includes(participant);

						if (hasInteracted || isWhitelisted) {
							const emojis = (process.env.REACT_STATUS || "❤️,💖,💜,✨,😍").split(",")
								.map((e) => e.trim())
								.filter(Boolean);

							if (emojis.length) {
								await conn.sendMessage(
									"status@broadcast",
									{
										react: {
											key: m.key,
											text: emojis[
												Math.floor(Math.random() * emojis.length)
											],
										},
									},
									{
										statusJidList: [
											conn.decodeJid(conn.user.id),
											conn.decodeJid(m.key.participant || m.sender),
										],
									}
								);
							}
						} else {
							console.log(`[ STATUS ] Skipped automatic reaction/comment for ${participant} (no interaction history or whitelist).`);
						}
					} catch (statusErr) {
						console.error("[ STATUS ERROR ] Error processing status react:", statusErr);
						if (global.pushSystemLog) {
							global.pushSystemLog("error", `Error procesando reacción de estado: ${statusErr.message}`);
						}
					}
				}

				try {
					await require("@system/case")(conn, m);
				} catch (caseErr) {
					console.error("[ CASE ERROR ]:", caseErr);
					if (global.pushSystemLog) {
						global.pushSystemLog("error", `Error en case.js: ${caseErr.message}`);
					}
					if (global.reportErrorToAdmin) {
						await global.reportErrorToAdmin(caseErr);
					}
				}

				try {
					await require("@system/handler")(conn, m, store, mydb);
				} catch (handlerErr) {
					console.error("[ HANDLER ERROR ]:", handlerErr);
					if (global.pushSystemLog) {
						global.pushSystemLog("error", `Error en handler.js: ${handlerErr.message}`);
					}
					if (global.reportErrorToAdmin) {
						await global.reportErrorToAdmin(handlerErr);
					}
				}
			} catch (upsertErr) {
				console.error("[ UPSERT ERROR ] Error in messages.upsert main handler:", upsertErr);
				if (global.pushSystemLog) {
					global.pushSystemLog("error", `Error crítico en messages.upsert: ${upsertErr.message}`);
				}
				if (global.reportErrorToAdmin) {
					await global.reportErrorToAdmin(upsertErr);
				}
			}
		});

		/** reject call */
		conn.ev.on("call", async (call) => {
			if (call[0].status === "offer") {
				await conn.rejectCall(call[0].id, call[0].from);
			}
		});

		/** clear tmp */
		if (!fs.existsSync("./tmp")) await fs.mkdirSync("./tmp");

		setInterval(
			async () => {
				try {
					const tmpFiles = await fs.readdirSync("./tmp");
					if (tmpFiles.length > 0) {
						tmpFiles
							.filter((v) => !v.endsWith(".file"))
							.map((v) => fs.unlinkSync("./tmp/" + v));
					}
				} catch {}
			},
			5 * 60 * 1000
		);

		/** save db every 30 seconds */
		setInterval(async () => {
			await mydb.write(global.db);
		}, 60_000);

		/** [IMPLEMENTACION 5] Scheduled messages background processor */
		setInterval(async () => {
			try {
				if (!global.db.scheduledMessages) global.db.scheduledMessages = [];
				const now = Date.now();
				const pending = global.db.scheduledMessages.filter(m => m.status === "pending" && m.time <= now);

				for (const msg of pending) {
					try {
						if (conn && conn.user) {
							if (msg.target === "all") {
								const users = Object.keys(global.db.users || {});
								for (const jid of users) {
									try {
										await conn.sendMessage(jid, { text: msg.message });
										await new Promise(resolve => setTimeout(resolve, 2000));
									} catch (e) {
										console.error(`Error sending scheduled broadcast to ${jid}:`, e);
									}
								}
							} else {
								await conn.sendMessage(msg.target, { text: msg.message });
							}
							msg.status = "sent";
							msg.sentAt = Date.now();
							await mydb.write(global.db);
							pushSystemLog("info", `Mensaje programado enviado con éxito.`);
						}
					} catch (err) {
						console.error("Error executing scheduled message:", err);
						pushSystemLog("error", `Error ejecutando mensaje programado: ${err.message}`);
					}
				}
			} catch (e) {
				console.error("Scheduler interval error:", e);
			}
		}, 30000);

		/** load plugins directory */
		loadPlugins(conn);
		/** watch plugins after change */
		watchPlugins(conn);

		let lastSentTime = 0;
		let suppressedCount = 0;

		global.reportErrorToAdmin = async (err) => {
			console.error("[ ERROR REPORT ]", err);
			try {
				const now = Date.now();
				if (now - lastSentTime < 5 * 60 * 1000) {
					suppressedCount++;
					console.log(`[ ERROR REPORT ] Suppressed error report. Total suppressed in 5m: ${suppressedCount}`);
					return;
				}

				if (global.conn && global.conn.user) {
					const adminJid = "5351080807@s.whatsapp.net";
					let errMsg = `⚠️ *INFORME DE ERROR AUTOMÁTICO*\n\n*Detalles del error:*\n- *Mensaje:* ${err.message || err}\n- *Stack:* \`\`\`${(err.stack || "").slice(0, 500)}\`\`\``;

					if (suppressedCount > 0) {
						errMsg += `\n\n- *Avisos de error adicionales suprimidos en los últimos 5 minutos:* ${suppressedCount}`;
					}

					await global.conn.sendMessage(adminJid, { text: errMsg });
					lastSentTime = now;
					suppressedCount = 0;
				}
			} catch (e) {
				console.error("[ ERROR REPORT ] Failed to send error report to admin:", e);
			}
		};

		/** handle & reject error */
		process.on("uncaughtException", async (err) => {
			console.error(err);
			if (global.reportErrorToAdmin) await global.reportErrorToAdmin(err);
		});
		process.on("unhandledRejection", async (reason) => {
			console.error(reason);
			const err = reason instanceof Error ? reason : new Error(String(reason));
			if (global.reportErrorToAdmin) await global.reportErrorToAdmin(err);
		});
	};

	// Start Web Admin Panel Express Server
	try {
		const startAdminPanel = require("@system/adminPanel");
		startAdminPanel(null, mydb);
	} catch (e) {
		console.error("[ ADMIN PANEL ERROR ] Failed to start admin panel:", e);
	}
/** [IMPLEMENTACION 14] Apagado gracioso: guarda la base de datos antes de morir.
	 *  Importante en Render, que envía SIGTERM en cada redeploy o reinicio manual;
	 *  sin esto se podían perder escrituras pendientes de la DB. */
	let shuttingDown = false;
	const gracefulShutdown = async (signal) => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`[ SHUTDOWN ] Señal ${signal} recibida. Guardando estado antes de salir...`);
		try {
			await mydb.write(global.db);
			console.log("[ SHUTDOWN ] Base de datos guardada correctamente.");
		} catch (e) {
			console.error("[ SHUTDOWN ] Error guardando la base de datos:", e.message);
		}
		process.exit(0);
	};
	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
	process.on("SIGINT", () => gracefulShutdown("SIGINT"));

	if (process.env.SKIP_WA === "true") {
		console.log("[ MACHINE ] SKIP_WA is true. Skipping WhatsApp connection logic for local development.");
	} else {
		connectWA();
	}
})();
