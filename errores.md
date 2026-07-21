# 📋 Registro de Incidentes y Soluciones (Yoshida Bot)

Este archivo documenta los errores e incidentes encontrados en el funcionamiento de Yoshida Bot, sus causas raíz, la forma en que se manifestaron y cómo se solucionaron, junto con explicaciones detalladas para facilitar el mantenimiento futuro.

---

## 💥 Incidente 1: Bloqueo de WhatsApp por Límite de Velocidad (`rate-overlimit`)

### 🔍 Descripción del Problema
El usuario reportó que el bot mostraba que estaba "escribiendo..." en WhatsApp de forma continua, pero nunca enviaba ninguna respuesta. Al revisar los logs de la consola en Render, se observó el siguiente error repetitivo:

```
[ ERROR REPORT ] Error: rate-overlimit
at async Object.groupFetchAllParticipating (/opt/render/project/src/node_modules/@whiskeysockets/baileys/lib/Socket/groups.js:26:24)
at async EventEmitter.<anonymous> (/opt/render/project/src/machine.js:677:28)
```

Seguido de:
```
[ UPSERT ERROR ] Error in messages.upsert main handler: Error: rate-overlimit
```

### 🎯 Causa Raíz
Dentro del archivo central de conexión de WhatsApp (`machine.js`), el callback para procesar los mensajes entrantes (`messages.upsert`) contenía la siguiente lógica para sincronizar metadatos de los grupos en el almacenamiento de memoria (store):

```javascript
/** add metadata to store */
if (
    store.groupMetadata &&
    Object.keys(store.groupMetadata).length === 0
)
    store.groupMetadata = await conn.groupFetchAllParticipating();
```

Cuando un usuario no está en ningún grupo o el store se inicializa vacío en el arranque, `Object.keys(store.groupMetadata).length === 0` es siempre verdadero.
Como consecuencia, **cada mensaje entrante (en chats privados o grupales) gatillaba una llamada síncrona inmediata a `conn.groupFetchAllParticipating()` hacia los servidores de WhatsApp.**
WhatsApp detectaba este volumen masivo de consultas repetitivas de metadatos como actividad sospechosa/spam y bloqueaba la conexión temporalmente con un error `rate-overlimit` (Código HTTP 429). El bot quedaba atrapado en un bucle intentando responder, mostrando el estado de "escribiendo..." pero sin poder enviar el mensaje real debido a la restricción.

### 🛠️ Solución Aplicada
Se implementó un mecanismo de **bloqueo por tiempo (cooldown lock)** y **aislamiento de excepciones** para optimizar las consultas a los servidores de WhatsApp.
En `machine.js`, el fragmento fue modificado de la siguiente manera:

```javascript
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
```

**Cómo funciona ahora:**
1. **Frecuencia Limitada (Cooldown):** Ahora solo se intenta realizar la sincronización de grupos si el store está vacío **y** han pasado al menos **10 minutos** desde el último intento (`global.lastGroupFetchTime`). Esto reduce las peticiones de miles por minuto a máximo una cada 10 minutos.
2. **Aislamiento de Excepciones:** La llamada está envuelta en un bloque `try...catch` independiente. Si por alguna razón la petición a los servidores de WhatsApp falla o es rechazada, el error se captura y se registra localmente en los logs del sistema sin interrumpir el flujo de ejecución principal del callback de mensajes. El bot puede continuar respondiendo otras conversaciones normalmente.

---

## ⚙️ Optimización de Respuestas de IA (Límites de Tokens y Creatividad)

### 🔍 Descripción del Problema
A veces, la IA generaba respuestas extremadamente largas y detalladas. Esto consumía demasiados tokens de salida (haciendo que el bot fuera lento) y causaba errores de límite con ciertos proveedores o un gasto excesivo en la API.

### 🎯 Solución y Personalización en el Panel de Administración
Se mejoró la configuración de salida de la inteligencia artificial tanto en el backend como en la interfaz gráfica del panel de administración para brindar un control preciso al administrador:

1. **Nuevo Límite de Longitud por Defecto:**
   Se modificó la configuración inicial en `machine.js` para reducir los tokens máximos de salida por defecto de `1000` a `450` tokens. Esto proporciona respuestas completas, ágiles y concisas sin saturar los chats.
2. **Descripciones de Ayuda en el Panel Admin (`views/admin.ejs`):**
   Se agregaron explicaciones visuales claras y rangos recomendados para personalizar los parámetros del modelo de IA directamente desde la pestaña **Personalidad / AI**:
   - **Tokens Máximos (maxLength):** Indica el límite de palabras/tokens de respuesta. Se recomiendan valores entre `150` y `500`. El administrador puede editar este campo para aumentarlo o disminuirlo según sus necesidades.
   - **Temperatura / Creatividad (creativity):** Ajusta qué tan creativo o preciso es el modelo. Un valor bajo (ej. `0.3`) es ideal para respuestas lógicas y estructuradas, mientras que un valor alto (ej. `1.0` o más) genera respuestas variadas y expresivas.

---

## 💥 Incidente 2: Desactivación de Canales, Grupos y Estados para un Funcionamiento de Mensajería Directo

### 🔍 Descripción del Problema
El usuario requería que el bot dejara de interactuar con grupos de WhatsApp, canales de difusión/newsletters y estados (historias), eliminando toda la sobrecarga de automatización correspondiente. El bot debía enfocarse única y exclusivamente en leer y responder de forma conversacional a mensajes directos/privados con la inteligencia artificial, eliminando por completo el sistema de comandos (p. ej., stickers, herramientas) y manteniendo las respuestas fluidas y naturales.

### 🎯 Causa Raíz y Complejidades
Anteriormente, el bot procesaba las actualizaciones de participantes de grupos, cambios grupales y reaccionaba a los estados/historias entrantes de WhatsApp de forma asíncrona. Asimismo, contenía un enrutador de comandos asíncrono robusto en `handler.js` que desviaba los mensajes con prefijo o disparaba plugins.

### 🛠️ Solución Aplicada
1. **Bypass de Grupos, Canales y Estados:** Se modificaron `machine.js` y `handler.js` para ignorar inmediatamente cualquier mensaje procedente de estados (`status@broadcast`), grupos (`remoteJid.endsWith("@g.us")`) y canales de difusión/boletines (`remoteJid.endsWith("@newsletter")`). Los callbacks de eventos `groups.update` y `group-participants.update` en `machine.js` fueron desactivados.
2. **Desactivación Completa de Comandos:** Se reestructuró la lógica de procesamiento en `handler.js` para que todos los mensajes de texto entrantes de chats directos sean redirigidos directamente al servicio unificado de inteligencia artificial (`generateAIResponse`), saltándose todo el procesamiento de comandos y plugins.

---

## 💥 Incidente 3: Fallos en las Respuestas de la IA (Falta de Respuesta y Estadísticas del Panel)

### 🔍 Descripción del Problema
Se reportó que el bot a veces no respondía al chat, y que el panel de administración no mostraba estadísticas de palabras más usadas (p. ej., "hola") a pesar de haberse enviado en múltiples ocasiones por WhatsApp.

### 🎯 Causa Raíz
1. **Regla de Inactividad de `self_mode`:** En `aiService.js`, la verificación de inactividad del bot (`self_mode`) filtraba y retornaba `null` para todas las personas, bloqueando incluso al dueño/administrador de recibir respuestas de prueba cuando el bot estaba inactivo.
2. **Orden de los Logs de Telemetría:** El registro de mensajes en la base de datos `recentLogs` se realizaba en `handler.js` después de diversos interceptores (como el de registro de usuarios o límites de mensajes). Si un usuario escribía "hola" antes de registrarse o quedaba atrapado en una validación previa, el mensaje nunca se guardaba en el historial de telemetría.
3. **Filtro de Palabras de Parada (Stop-Words):** En `adminPanel.js`, las palabras conversacionales comunes como `"hola"`, `"gracias"`, `"bot"` y `"yoshida"` se encontraban dentro de la lista negra de palabras excluidas (`stopWords`), impidiendo su visualización en el gráfico de frecuencia de palabras del panel.

### 🛠️ Solución Aplicada
1. **Excepción de Administración en Inactividad:** Se corrigió la lógica en `aiService.js` para que el bot responda al dueño o administrador incluso si `self_mode` está encendido.
2. **Priorización de Logs:** Se reubicó la sección de registro e inserción en `recentLogs` al inicio de `handler.js`, inmediatamente después de la validación del esquema. De esta forma, cada "hola" u otro mensaje se registra para telemetría sin importar el flujo o estado de registro.
3. **Optimización del Filtro `stopWords`:** Se removieron términos de conversación clave como `"hola"`, `"gracias"`, `"bot"` y `"yoshida"` del conjunto de palabras de parada de la telemetría en `adminPanel.js`. Ahora, el panel puede contar y reflejar correctamente cuáles son los términos más usados por los usuarios de WhatsApp.

---

## ⚙️ Nueva Característica: Mensajería Manual Directa desde el Panel de Administración

### 🔍 Descripción de la Característica
Se requería un apartado en el panel de administración para poder redactar y enviar mensajes manuales a personas específicas directamente por medio del socket del bot.

### 🛠️ Solución Implementada
1. **Backend Endpoint:** Se implementó una nueva ruta segura `POST /api/manual-message` en `system/adminPanel.js` que extrae el número de teléfono, lo normaliza a formato de JID de WhatsApp y envía el mensaje de texto de manera inmediata a través del socket activo de Baileys (`global.conn.sendMessage`). Además, el mensaje saliente se registra en la sección de logs de chat para mantener el historial completo.
2. **Frontend UI Card:** Se diseñó una tarjeta con estilo Glassmorphic iOS en `views/admin.ejs` con campos para ingresar el número telefónico con código de país y el cuerpo del mensaje, conectada mediante AJAX con el endpoint del backend para brindar retroalimentación instantánea.

---

## 📈 Conclusión y Recomendaciones de Mantenimiento
- **Monitoreo de Logs:** En caso de que se vuelva a presenciar inactividad, revisa los logs del sistema desde la pestaña de **Telemetría** o **Logs de Chat** en el panel para descartar nuevas restricciones de tasa.
- **Configuraciones de la IA:** Mantener los tokens máximos de salida bajo `500` para garantizar respuestas rápidas y prevenir caídas por agotamiento de créditos en APIs externas como Gemini o OpenRouter.
