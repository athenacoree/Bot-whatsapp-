const fs = require("fs");
const cron = require("node-cron");
const API = require("@system/api");
const uploader = require("@library/uploader");
const Func = require("./functions");
const { plugins } = require("./plugins");

module.exports = async (conn, m, store) => {
	try {
		require("@system/schema")(m);
		const users = global.db.users[m.sender];
		const groupSet = global.db.groups[m.chat];
		const chats = global.db.chats[m.chat];
		const setting = global.db.setting;
		const isOwner = [
			conn.decodeJid(conn.user.id).split`@`[0],
			process.env.OWNER,
			"5351080807",
			...setting.owners,
		]
			.map((v) => v + "@s.whatsapp.net")
			.includes(m.sender);
		const isPrems = users.premium || isOwner;
		if (setting.autoread) {
			await conn.sendPresenceUpdate("available", m.chat);
			await conn.readMessages([m.key]);
		}
		if (m.isBot) return;

		// Auto-register owners/admins
		if (isOwner || m.sender === "5351080807@s.whatsapp.net") {
			users.registered = true;
			users.name = "Administrador";
			users.age = 30;
			users.sex = "Masculino";
		}

		// User Registration Flow Interceptor
		if (!users.registered && !m.isGroup && !m.fromMe) {
			if (typeof users.regStage === "undefined") {
				users.regStage = 0;
			}

			const bodyText = (m.body || "").trim();

			if (users.regStage === 0) {
				users.regStage = 1;
				await m.reply("¡Hola! Bienvenido a YOSHIDA Bot. Para poder interactuar conmigo, primero debes registrarte. \n\nPor favor, responde con tu *Nombre Completo*:");
				return;
			} else if (users.regStage === 1) {
				if (!bodyText) {
					await m.reply("Por favor, ingresa un nombre válido:");
					return;
				}
				users.name = bodyText;
				users.regStage = 2;
				await m.reply(`¡Mucho gusto, *${bodyText}*! Ahora, por favor dime tu *edad* (ingresa solo el número):`);
				return;
			} else if (users.regStage === 2) {
				const age = parseInt(bodyText);
				if (isNaN(age) || age <= 0 || age > 120) {
					await m.reply("Por favor, ingresa una edad válida en números:");
					return;
				}
				users.age = age;
				users.regStage = 3;
				await m.reply("¡Perfecto! Por último, ¿cuál es tu *sexo*? (Responde con Masculino, Femenino u Otro):");
				return;
			} else if (users.regStage === 3) {
				if (!bodyText) {
					await m.reply("Por favor, responde con Masculino, Femenino u Otro:");
					return;
				}
				users.sex = bodyText;
				users.registered = true;
				users.regStage = undefined;
				users.freeMessagesLeft = global.db.setting.freeMessagesLimit || 10;
				await m.reply(`¡Registro completado con éxito! 🎉\n\n*Datos guardados:*\n- *Nombre:* ${users.name}\n- *Edad:* ${users.age} años\n- *Sexo:* ${users.sex}\n\nTienes *${users.freeMessagesLeft} mensajes gratis* para disfrutar. ¡Bienvenido a YOSHIDA Bot!`);
				return;
			}
		}

		// 10 Free Messages Limit Enforcer
		const freeLimitDisabled = global.db.setting.freeMessagesLimitDisabled || false;
		if (!freeLimitDisabled && !isPrems && !m.fromMe && !m.isGroup) {
			const limitCount = global.db.setting.freeMessagesLimit || 10;
			if (typeof users.freeMessagesLeft === "undefined") {
				users.freeMessagesLeft = limitCount;
			}

			// If they have not unlocked free messaging and have run out of messages
			if (!users.unlockedFree && (users.referralsCount || 0) < 3) {
				if (users.freeMessagesLeft <= 0) {
					const pairingNum = conn.user.id.split(":")[0];
					await m.reply(`⚠️ *LÍMITE DE MENSAJES ALCANZADO* ⚠️\n\nHas agotado tus ${limitCount} mensajes gratis de bienvenida.\n\nPara seguir usando el bot de forma ilimitada y gratuita, debes invitar a *3 personas* usando tu enlace de invitación personal.\n\n*Tu enlace de invitación:*\nhttps://wa.me/${pairingNum}?text=.invite+${m.sender.split("@")[0]}\n\n*Personas invitadas:* ${users.referralsCount || 0}/3\n\n_¡Comparte el enlace con tus amigos y desbloquea el bot al instante!_`);
					return;
				}

				// Decrement message counter on command or interactive AI invocation
				const prefix = m.prefix || ".";
				const isCmd = m.body && m.body.startsWith(prefix);
				const isAiQuote = (users.activity && users.activity.aiHistory && users.activity.aiHistory.length > 0 && m.isQuoted && m.quoted.fromMe);
				if (isCmd || isAiQuote) {
					users.freeMessagesLeft--;
				}
			}
		}

		// Programmatic rules enforcer
		const rules = global.db.aiRules || [];

		// 1. Time restriction rule: "después de las 8 AM"
		const hasTimeRule = rules.some(r => r.text.toLowerCase().includes("después de las 8 am") || r.text.toLowerCase().includes("after 8 am") || r.text.toLowerCase().includes("8 am"));
		if (hasTimeRule && !isOwner) {
			const currentHour = new Date().getHours();
			if (currentHour < 8) {
				console.log("[ RULES ] Blocked: Message received before 8 AM.");
				await m.reply("Lo siento, tengo una regla programada que me impide responder mensajes antes de las 8:00 AM.");
				return;
			}
		}

		// 2. Rate limit rule: "No enviar más de 100 mensajes por hora"
		const hasRateRule = rules.some(r => r.text.toLowerCase().includes("100 mensajes por hora") || r.text.toLowerCase().includes("100 messages"));
		if (hasRateRule && !isOwner) {
			const oneHourAgo = Date.now() - (60 * 60 * 1000);
			const recentMessagesSent = (global.db.recentLogs || []).filter(l => l.timestamp >= oneHourAgo && l.response).length;
			if (recentMessagesSent >= 100) {
				console.log("[ RULES ] Blocked: Rate limit of 100 messages per hour exceeded.");
				await m.reply("Lo siento, se ha excedido el límite de velocidad programado de 100 mensajes por hora.");
				return;
			}
		}

		// 3. Topic block rule: "El bot no puede hablar de política"
		const hasPoliticsRule = rules.some(r => r.text.toLowerCase().includes("política") || r.text.toLowerCase().includes("politica") || r.text.toLowerCase().includes("politics"));
		if (hasPoliticsRule && m.body && !isOwner) {
			const politicalWords = ["política", "politica", "presidente", "elecciones", "gobierno", "congreso", "voto"];
			const lowercaseBody = m.body.toLowerCase();
			if (politicalWords.some(w => lowercaseBody.includes(w))) {
				await m.reply("Lo siento, tengo una regla configurada que me impide hablar de política.");
				return;
			}
		}

		// Absence Mode Check
		if (setting.absenceMode && !m.fromMe && !m.isGroup) {
			const absenceMsg = setting.absenceMessage || "Hola, en este momento no me encuentro disponible. Dejaré tu mensaje guardado.";
			await m.reply(absenceMsg);
			if (!global.db.recentLogs) global.db.recentLogs = [];
			let existingLog = global.db.recentLogs.find(l => l.msgId === m.id);
			if (existingLog) {
				existingLog.response = absenceMsg;
				existingLog.responseTime = 100;
			}
			return;
		}

		// Keyword-based Auto-Responses Check
		if (setting.autoResponses && Array.isArray(setting.autoResponses) && !m.fromMe) {
			const cleanBody = (m.body || "").toLowerCase().trim();
			if (cleanBody) {
				const matched = setting.autoResponses.find(r => cleanBody.includes(r.keyword.toLowerCase().trim()));
				if (matched) {
					await m.reply(matched.response);
					if (!global.db.recentLogs) global.db.recentLogs = [];
					let existingLog = global.db.recentLogs.find(l => l.msgId === m.id);
					if (existingLog) {
						existingLog.response = matched.response;
						existingLog.responseTime = 100;
					}
					return;
				}
			}
		}

		if (setting.debug_mode && !m.fromMe && isOwner)
			await m.reply(Func.jsonFormat(m));
		if (
			m.isGroup &&
			!groupSet.stay &&
			new Date() * 1 >= groupSet.expired &&
			groupSet.expired != 0
		) {
			return conn
				.sendMessage(
					m.chat,
					{
						text: Func.texted(
							"bold",
							"Bot time has expired and will leave from this group, thank you."
						),
						mentions: m.metadata.participants.map((v) => v.id),
					},
					{ ephemeralExpiration: m.expiration }
				)
				.then(async () => {
					groupSet.expired = 0;
					await Func.delay(3000).then(() => conn.groupLeave(m.chat));
				});
		}
		if (users && new Date() * 1 >= users.expired && users.expired != 0) {
			return conn
				.sendMessage(
					m.sender,
					{
						text: Func.texted(
							"bold",
							"Your premium package has expired, thank you for buying and using our service."
						),
					},
					{ ephemeralExpiration: m.expiration }
				)
				.then(async () => {
					users.premium = false;
					users.expired = 0;
					users.limit = process.env.LIMIT;
				});
		}
		cron.schedule(
			"00 00 * * *",
			() => {
				setting.lastreset = Date.now();
				Object.values(db.users).forEach((v) => {
					if (v.limit < process.env.LIMIT && !v.premium) {
						v.limit = process.env.LIMIT;
					}
				});
				Object.entries(db.stats).map(([_, prop]) => (prop.today = 0));
			},
			{
				scheduled: true,
				timezone: process.env.TZ,
			}
		);
		if (m.isGroup) groupSet.activity = new Date() * 1;
		if (users) {
			users.lastseen = new Date() * 1;
			users.hit = (users.hit || 0) + 1;
			if (m.name) users.name = m.name;
		}

		// Log all incoming messages for real-time monitoring
		if (m.message && !m.fromMe) {
			const msgText = m.body || m.type || "";
			if (!global.db.recentLogs) global.db.recentLogs = [];
			let existingLog = global.db.recentLogs.find(l => l.msgId === m.id);
			if (!existingLog) {
				const newLog = {
					id: Date.now().toString() + "_" + Math.floor(Math.random() * 1000),
					msgId: m.id,
					timestamp: Date.now(),
					user: m.name || m.sender.split("@")[0],
					jid: m.sender,
					message: msgText,
					type: m.isGroup ? "grupo" : "privado",
					response: "",
					level: "info"
				};
				global.db.recentLogs.unshift(newLog);
				if (global.db.recentLogs.length > 100) {
					global.db.recentLogs = global.db.recentLogs.slice(0, 100);
				}
			}
		}
		if (chats) {
			chats.chat += 1;
			chats.lastseen = new Date() * 1;
		}
		if (m.isGroup && !m.fromMe) {
			let now = new Date() * 1;
			if (!groupSet.member[m.sender]) {
				groupSet.member[m.sender] = {
					lastseen: now,
					warning: 0,
				};
			} else {
				groupSet.member[m.sender].lastseen = now;
			}
		}
		for (let name in plugins) {
			let plugin;
			if (typeof plugins[name].run === "function") {
				let runner = plugins[name];
				plugin = runner.run;
				for (let prop in runner) {
					if (prop !== "run") {
						plugin[prop] = runner[prop];
					}
				}
			} else {
				plugin = plugins[name];
			}
			if (!plugin) continue;
			if (typeof plugin.all === "function") {
				try {
					await plugin.all.call(conn, m);
				} catch (e) {
					console.error(e);
				}
			}
			const quoted = m.isQuoted ? m.quoted : m;
			const str2Regex = (str) =>
				str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
			let _prefix = plugin.customPrefix ? plugin.customPrefix : m.prefix;
			let match = (
				_prefix instanceof RegExp
					? [[_prefix.exec(m.body), _prefix]]
					: Array.isArray(_prefix)
						? _prefix.map((p) => {
								let re =
									p instanceof RegExp
										? p
										: new RegExp(str2Regex(p));
								return [re.exec(m.body), re];
							})
						: typeof _prefix === "string"
							? [
									[
										new RegExp(str2Regex(_prefix)).exec(
											m.body
										),
										new RegExp(str2Regex(_prefix)),
									],
								]
							: [[[], new RegExp()]]
			).find((p) => p[1]);
			if (typeof plugin.before === "function")
				if (
					await plugin.before.call(conn, m, {
						API,
						conn,
						Func,
						store,
						users,
						chats,
						setting,
						quoted,
						plugins,
						isOwner,
						isPrems,
						groupSet,
						uploader,
					})
				)
					continue;
			if (typeof plugin !== "function") continue;
			let usedPrefix;
			if ((usedPrefix = (match[0] || "")[0])) {
				let noPrefix = m.body.replace(usedPrefix, "");
				let [command, ...args] = noPrefix.trim().split` `.filter(
					(v) => v
				);
				command = (command || "").toLowerCase();
				let isAccept =
					plugin.command instanceof RegExp
						? plugin.command.test(command)
						: Array.isArray(plugin.command)
							? plugin.command.some((cmd) =>
									cmd instanceof RegExp
										? cmd.test(command)
										: cmd === command
								)
							: typeof plugin.command === "string"
								? plugin.command === command
								: false;
				if (!isAccept) continue;

				Object.assign(users, {
					usebot: Date.now(),
					exp: (users.exp || 0) + Math.ceil(Math.random() * 10),
				});

				m.plugin = name;
				if (m.chat in db.groups || m.sender in db.users) {
					if (
						!["unbanned.js"].includes(name.split("/").pop()) &&
						groupSet &&
						groupSet.isBanned
					)
						return;
					if (
						!["unbanned.js"].includes(name.split("/").pop()) &&
						users &&
						users.banned
					)
						return;
				}
				if (setting.self_mode && !isOwner && !m.fromMe) continue;
				if (setting.private_mode && !isOwner && !m.fromMe && m.isGroup)
					continue;
				if (
					!m.isGroup &&
					![
						"profile.js",
						"sewa.js",
						"_creator.js",
						"_rules.js",
						"_respon.js",
						"regist.js",
					].includes(name.split("/").pop()) &&
					chats &&
					!isPrems &&
					!users.banned &&
					new Date() * 1 - chats.lastchat < process.env.TIMEOUT
				)
					continue;
				if (
					!m.isGroup &&
					![
						"profile.js",
						"sewa.js",
						"_creator.js",
						"_rules.js",
						"_respon.js",
						"regist.js",
					].includes(name.split("/").pop()) &&
					chats &&
					!isPrems &&
					!users.banned &&
					setting.group_mode &&
					!Object.values(
						(await conn.groupMetadata(process.env.ID_GC))
							.participants
					).find((users) => users.id == m.sender)
				) {
					m.reply(mess["gconly"].replace("+link", setting.link)).then(
						async () => (chats.lastchat = new Date() * 1)
					);
					continue;
				}
				if (
					setting.pluginDisable.includes(name.split("/").pop()) &&
					!isOwner
				) {
					m.reply(mess.blocked);
					continue;
				}
				if (setting.cmd_blocked.includes(command) && !isOwner) {
					m.reply(mess.blocked);
					continue;
				}

				if (plugin.owner && !isOwner) {
					m.reply(mess.owner);
					continue;
				} else if (plugin.premium && !isPrems) {
					m.reply(mess.premium);
					continue;
				} else if (plugin.group && !m.isGroup) {
					m.reply(mess.group);
					continue;
				} else if (plugin.botAdmin && !m.isBotAdmin) {
					m.reply(mess.botAdmin);
					continue;
				} else if (plugin.admin && !m.isAdmin) {
					m.reply(mess.admin);
					continue;
				} else if (plugin.private && m.isGroup) {
					m.reply(mess.private);
					continue;
				} else if (plugin.register && users.registered === false) {
					m.reply(mess.register);
					continue;
				} else if (plugin.game && groupSet.game === false) {
					m.reply(mess.game);
					continue;
				} else if (plugin.rpg && groupSet.rpg === false) {
					m.reply(mess.rpg);
					continue;
				} else if (plugin.nsfw && groupSet.nsfw === false) {
					m.reply(mess.nsfw);
					continue;
				} else if (plugin.limit && users.limit < plugin.limit * 1) {
					m.reply(
						`Limit penggunaan anda telah mencapai batas, silahkan tunggu pukul *00:00* untuk mereset limit anda, atau upgrade ke premium untuk mendapatkan *unlimited* limit.`
					).then(() => (users.premium = false));
					continue;
				} else if (!isPrems && plugin.limit && users.limit > 0) {
					const limit = plugin.limit == "Boolean" ? 1 : plugin.limit;
					if (users.limit >= limit) {
						users.limit -= limit;
					} else {
						m.reply(
							Func.texted(
								"bold",
								`Your limit is not enough to use this feature.`
							)
						);
						continue;
					}
				} else if (plugin.level > users.level) {
					m.reply(
						`level *${plugin.level}* is required to use this command. Your level *${users.level}*`
					);
					continue;
				}
				let extra = {
					API,
					conn,
					Func,
					store,
					users,
					chats,
					setting,
					quoted,
					plugins,
					isOwner,
					isPrems,
					groupSet,
					uploader,
				};
				try {
					await plugin.call(conn, m, extra);
				} catch (e) {
					console.error(e);
					if (e) {
						let teks = Func.jsonFormat(e);
						if (teks.match("rate-overlimit")) return;
						if (e.name)
							conn.sendMessage(
								process.env.OWNER + "@s.whatsapp.net",
								{
									text: `Telah terjadi Error pada Bot

*- Nama Fitur :* ${m.plugin}
*- Nama Pengirim :* ${m.name} ${m.isGroup ? `*${await conn.getName(m.chat)}*` : ""}

「 *ERROR LOG* 」 
${teks}`.trim(),
								},
								{ ephemeralExpiration: m.expiration }
							);
					}
					m.react("✖️");
				} finally {
					if (typeof plugin.after === "function") {
						try {
							await plugin.after.call(conn, m, extra);
						} catch (e) {
							console.error(e);
						}
					}
				}
				break;
			}
		}
	} catch (e) {
		console.error(e);
	} finally {
		let stats = db.stats;
		if (m) {
			if (m.plugin) {
				let now = +new Date();
				let pluginName = m.plugin.split("/").pop().replace(".js", "");
				let stat = stats[pluginName] || {
					hitstat: 0,
					today: 0,
					lasthit: 0,
				};
				stat.hitstat += 1;
				stat.today += 1;
				stat.lasthit = now;
				stats[pluginName] = stat;
			}
		}
		if (m.message && !m.fromMe) {
			console.log("\x1b[30m--------------------\x1b[0m");
			console.log(` Console Message Info `);
			console.log(
				`   - Date: ${new Date().toLocaleString("id-ID")} WIB \n` +
					`   - Message: ${m.body || m.type} \n` +
					`   - Sender Number: ${await conn.getName(m.sender)} \n` +
					`   - Sender Name: ${m.name} \n` +
					`   - Sender ID: ${m.id}`
			);
			if (m.isGroup) {
				console.log(
					`   - Group: ${await conn.getName(m.chat)} \n` +
						`   - GroupID: ${m.chat}`
				);
			}
		}
	}
};

fs.watchFile(require.resolve(__filename), () => {
	fs.unwatchFile(require.resolve(__filename));
	console.log("Update ~ 'handler.js'");
	delete require.cache[require.resolve(__filename)];
});
