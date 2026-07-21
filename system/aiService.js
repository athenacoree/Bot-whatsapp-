const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Fetch available tools from an MCP server
 */
async function fetchMcpTools(serverUrl) {
    try {
        // Try standard JSON-RPC tools/list
        const res = await fetch(serverUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/list",
                params: {},
                id: 1
            }),
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.result && Array.isArray(data.result.tools)) {
                return data.result.tools;
            }
        }
    } catch (e) {
        // Fallback
    }

    try {
        // Try simple REST GET /tools
        const toolsUrl = serverUrl.endsWith("/tools") ? serverUrl : `${serverUrl}/tools`;
        const res = await fetch(toolsUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) return data;
            if (data.tools && Array.isArray(data.tools)) return data.tools;
        }
    } catch (e) {
        // Ignore
    }
    return [];
}

/**
 * Call tool on MCP server
 */
async function callMcpTool(serverUrl, toolName, args) {
    try {
        // Try standard JSON-RPC tools/call
        const res = await fetch(serverUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                    name: toolName,
                    arguments: args
                },
                id: 1
            }),
            signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.result && data.result.content) {
                return typeof data.result.content === "string"
                    ? data.result.content
                    : JSON.stringify(data.result.content);
            }
        }
    } catch (e) {
        // Fallback
    }

    try {
        const callUrl = serverUrl.endsWith("/call") ? serverUrl : `${serverUrl}/call`;
        const res = await fetch(callUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: toolName, arguments: args }),
            signal: AbortSignal.timeout(10000)
        });
        if (res.ok) {
            const data = await res.json();
            return typeof data === "string" ? data : JSON.stringify(data.result || data);
        }
    } catch (e) {
        // Error
    }
    return "Error executing MCP tool.";
}

/**
 * Unified AI Response Generation
 */
async function generateAIResponse(m, userText, conn) {
    try {
        const aiConfig = global.db.aiConfig;
        const aiRules = global.db.aiRules || [];
        const proactiveContacts = global.db.proactiveContacts || [];

        // Check if sender is in proactive contacts and status is pending or sent, update to responded
        const senderNum = m.sender.split("@")[0];
        const contactIdx = proactiveContacts.findIndex(c => c.number.replace(/[^0-9]/g, "") === senderNum.replace(/[^0-9]/g, ""));
        if (contactIdx !== -1) {
            const status = proactiveContacts[contactIdx].status;
            if (status === "pendiente" || status === "enviado") {
                proactiveContacts[contactIdx].status = "respondido";
                proactiveContacts[contactIdx].timestamp = Date.now();
                console.log(`[ PROACTIVE ] Updated status for proactive contact ${proactiveContacts[contactIdx].number} to 'respondido'`);
            }
        }

        // Construct System Instruction dynamically
        const isAdmin = conn && conn.user && [
            conn.decodeJid(conn.user.id).split`@`[0],
            process.env.OWNER,
            "5351080807",
            ...(global.db.setting.owners || [])
        ]
            .map((v) => v + "@s.whatsapp.net")
            .includes(m.sender);

        // Check if Bot is currently inactive (ignore if message sender is the admin/owner so they can still receive responses)
        const botStatus = (global.db.setting.self_mode !== undefined) ? !global.db.setting.self_mode : true;
        if (!botStatus && !isAdmin) {
            return null; // Bot is inactive/self mode
        }

        let systemInstruction = "";
        if (isAdmin && aiConfig.adminPersonality) {
            systemInstruction = `${aiConfig.adminPersonality}\n\nTono de conversación: ${aiConfig.adminTone || aiConfig.tone}\nIdioma principal: ${aiConfig.language}\n`;
        } else {
            systemInstruction = `${aiConfig.personality}\n\nTono de conversación: ${aiConfig.tone}\nIdioma principal: ${aiConfig.language}\n`;
        }

        if (aiRules.length > 0) {
            systemInstruction += "\nReglas que debes seguir estrictamente:\n";
            aiRules.forEach((rule, idx) => {
                systemInstruction += `${idx + 1}. [Prioridad: ${rule.priority.toUpperCase()}] ${rule.text}\n`;
            });
        }

        // Initialize User Chat History
        if (!global.db.users[m.sender]) {
            global.db.users[m.sender] = {};
        }
        if (!global.db.users[m.sender].activity) {
            global.db.users[m.sender].activity = {};
        }
        if (!global.db.users[m.sender].activity.aiHistory || !Array.isArray(global.db.users[m.sender].activity.aiHistory)) {
            global.db.users[m.sender].activity.aiHistory = [];
        }

        const history = global.db.users[m.sender].activity.aiHistory;

        // Prune history to last 15 entries to save tokens
        if (history.length > 15) {
            history.splice(0, history.length - 15);
        }

        // Collect MCP Tools if enabled
        let mcpTools = [];
        let mcpServersToQuery = [];
        if (aiConfig.mcpEnabled && Array.isArray(aiConfig.mcpServers)) {
            mcpServersToQuery = aiConfig.mcpServers;
            for (const srv of mcpServersToQuery) {
                const tools = await fetchMcpTools(srv.url);
                mcpTools.push(...tools.map(t => ({ ...t, _serverUrl: srv.url })));
            }
        }

        let responseText = "";
        let toolCallsMade = [];

        // Call proper AI model provider
        const provider = aiConfig.provider || "gemini";
        const apiKey = aiConfig.apiKey ||
            (provider === "gemini" ? process.env.GEMINI_API_KEY :
             provider === "openrouter" ? process.env.OPENROUTER_API_KEY :
             provider === "grok" ? process.env.GROK_API_KEY : "");
        const modelName = aiConfig.model || (provider === "gemini" ? "gemini-2.0-flash" : "");

        if (provider === "gemini") {
            if (!apiKey) {
                throw new Error("GEMINI_API_KEY is not defined in environment or panel config.");
            }
            const genAI = new GoogleGenerativeAI(apiKey);

            // Format tools for Gemini API
            const geminiTools = mcpTools.length > 0 ? [{
                functionDeclarations: mcpTools.map(t => ({
                    name: t.name,
                    description: t.description || "",
                    parameters: t.inputSchema || { type: "object", properties: {} }
                }))
            }] : undefined;

            const geminiModel = genAI.getGenerativeModel({
                model: modelName || "gemini-2.0-flash",
                systemInstruction: systemInstruction,
                tools: geminiTools,
                generationConfig: {
                    maxOutputTokens: aiConfig.maxLength,
                    temperature: aiConfig.creativity
                }
            });

            // Format history for Gemini chat structure
            const geminiHistory = history.map(h => ({
                role: h.role === "assistant" ? "model" : "user",
                parts: [{ text: h.content }]
            }));

            const chat = geminiModel.startChat({ history: geminiHistory });
            let result = await chat.sendMessage(userText);

            // Check for tool calls
            const contentParts = result.response?.candidates?.[0]?.content?.parts;
            if (contentParts && contentParts.length > 0 && contentParts[1]?.functionCall) {
                const funcCall = contentParts[1].functionCall;
                toolCallsMade.push(funcCall);
                const matchedTool = mcpTools.find(t => t.name === funcCall.name);
                if (matchedTool) {
                    const toolResult = await callMcpTool(matchedTool._serverUrl, funcCall.name, funcCall.args);
                    // Send tool response back to Gemini to get final answer
                    const followUp = await chat.sendMessage([{
                        functionResponse: {
                            name: funcCall.name,
                            response: { result: toolResult }
                        }
                    }]);
                    responseText = followUp.response.text();
                } else {
                    responseText = "Llamada a herramienta no soportada.";
                }
            } else {
                responseText = result.response.text();
            }

        } else if (provider === "openrouter" || provider === "grok") {
            const apiEndpoint = provider === "openrouter"
                ? "https://openrouter.ai/api/v1/chat/completions"
                : "https://api.x.ai/v1/chat/completions";

            if (!apiKey) {
                throw new Error(`${provider.toUpperCase()} API Key is required.`);
            }

            // Map history for OpenAI format
            const openAiHistory = history.map(h => ({
                role: h.role,
                content: h.content
            }));
            openAiHistory.push({ role: "user", content: userText });

            const formattedMcpTools = mcpTools.length > 0 ? mcpTools.map(t => ({
                type: "function",
                function: {
                    name: t.name,
                    description: t.description || "",
                    parameters: t.inputSchema || { type: "object", properties: {} }
                }
            })) : undefined;

            const requestBody = {
                model: modelName || (provider === "openrouter" ? "google/gemini-2.0-flash" : "grok-2-1212"),
                messages: [
                    { role: "system", content: systemInstruction },
                    ...openAiHistory
                ],
                max_tokens: aiConfig.maxLength,
                temperature: aiConfig.creativity,
                tools: formattedMcpTools
            };

            const response = await fetch(apiEndpoint, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/athenacoree/Bot-whatsapp-",
                    "X-Title": "Yoshida Bot Admin"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API returned error (${response.status}): ${errorText}`);
            }

            const resData = await response.json();
            const choice = resData.choices?.[0];
            const message = choice?.message;

            if (message?.tool_calls && message.tool_calls.length > 0) {
                const toolCall = message.tool_calls[0];
                toolCallsMade.push(toolCall.function);
                const matchedTool = mcpTools.find(t => t.name === toolCall.function.name);
                if (matchedTool) {
                    const parsedArgs = typeof toolCall.function.arguments === "string"
                        ? JSON.parse(toolCall.function.arguments)
                        : toolCall.function.arguments;
                    const toolResult = await callMcpTool(matchedTool._serverUrl, toolCall.function.name, parsedArgs);

                    // Call again with tool results
                    const finalRequestBody = {
                        model: requestBody.model,
                        messages: [
                            { role: "system", content: systemInstruction },
                            ...openAiHistory,
                            message,
                            {
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: toolResult
                            }
                        ]
                    };

                    const finalResponse = await fetch(apiEndpoint, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(finalRequestBody)
                    });

                    if (finalResponse.ok) {
                        const finalData = await finalResponse.json();
                        responseText = finalData.choices?.[0]?.message?.content || "";
                    } else {
                        responseText = "Error al procesar el resultado de la herramienta.";
                    }
                } else {
                    responseText = "Llamada a herramienta no soportada.";
                }
            } else {
                responseText = message?.content || "";
            }
        } else {
            throw new Error(`Unsupported AI model provider: ${provider}`);
        }

        // Push current messages to user history
        history.push({ role: "user", content: userText });
        history.push({ role: "assistant", content: responseText });

        // Record Log of interaction and calculate responseTime telemetry
        if (!global.db.recentLogs) global.db.recentLogs = [];
        let existingLog = global.db.recentLogs.find(l => l.msgId === m.id);
        if (existingLog) {
            existingLog.response = responseText;
            existingLog.responseTime = Date.now() - existingLog.timestamp;
            existingLog.level = "info";
        } else {
            const newLog = {
                id: Date.now().toString() + "_" + Math.floor(Math.random() * 1000),
                msgId: m.id || "",
                timestamp: Date.now(),
                user: m.name || m.sender.split("@")[0],
                jid: m.sender,
                message: userText,
                type: m.isGroup ? "grupo" : "privado",
                response: responseText,
                level: "info",
                responseTime: 1500 // fallback default
            };
            global.db.recentLogs.unshift(newLog);
            if (global.db.recentLogs.length > 100) {
                global.db.recentLogs = global.db.recentLogs.slice(0, 100);
            }
        }

        // Increment user interaction counter
        if (global.db.users[m.sender]) {
            if (!global.db.users[m.sender].interactive) global.db.users[m.sender].interactive = 0;
            global.db.users[m.sender].interactive += 1;
        }

        return responseText;
    } catch (error) {
        console.error("[ AI SERVICE ERROR ]:", error);

        // Log Error as well
        const errLog = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            user: m.name || m.sender.split("@")[0],
            message: userText,
            type: m.isGroup ? "grupo" : "privado",
            response: `Error: ${error.message}`
        };
        global.db.recentLogs.unshift(errLog);
        if (global.db.recentLogs.length > 100) {
            global.db.recentLogs = global.db.recentLogs.slice(0, 100);
        }

        return `Ups! Ocurrió un error al procesar tu solicitud: ${error.message}`;
    }
}

module.exports = {
    generateAIResponse,
    fetchMcpTools,
    callMcpTool
};
