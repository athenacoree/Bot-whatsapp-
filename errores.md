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

## 📈 Conclusión y Recomendaciones de Mantenimiento
- **Monitoreo de Logs:** En caso de que se vuelva a presenciar inactividad, revisa los logs del sistema desde la pestaña de **Telemetría** o **Logs de Chat** en el panel para descartar nuevas restricciones de tasa.
- **Configuraciones de la IA:** Mantener los tokens máximos de salida bajo `500` para garantizar respuestas rápidas y prevenir caídas por agotamiento de créditos en APIs externas como Gemini o OpenRouter.
