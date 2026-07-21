module.exports = {
  help: ["tagall", "hidetag"],
  tags: ["group"],
  command: /^(tagall|hidetag)$/i,
  run: async (m, { conn, command, args, isOwner }) => {
    // Ensure this is run in a group
    if (!m.isGroup) return m.reply(mess.group);

    // Ensure the sender is a group admin or bot owner
    const groupMetadata = m.metadata || await conn.groupMetadata(m.chat);
    const participants = groupMetadata.participants || [];
    const senderObj = participants.find(p => p.id === m.sender);
    const isAdmin = senderObj && (senderObj.admin === "admin" || senderObj.admin === "superadmin");

    if (!isAdmin && !isOwner) {
      return m.reply(mess.admin);
    }

    const message = args.join(" ") || "¡Atención a todos!";
    const mentionJids = participants.map(p => p.id);

    const cmd = command.toLowerCase();

    // 1. Tagall (Visible mentions)
    if (cmd === "tagall") {
      let tagMsg = `*📢 CONVOCATORIA GRUPAL*\n\n*Mensaje:* ${message}\n\n`;
      participants.forEach((p, index) => {
        tagMsg += `${index + 1}. @${p.id.split("@")[0]}\n`;
      });
      tagMsg += `\n> _Menciones emitidas por el administrador_`;

      await conn.sendMessage(m.chat, { text: tagMsg, mentions: mentionJids }, { quoted: m });
    }

    // 2. Hidetag (Invisible mentions)
    else if (cmd === "hidetag") {
      await conn.sendMessage(m.chat, { text: message, mentions: mentionJids }, { quoted: m });
    }
  },
  group: true
};
