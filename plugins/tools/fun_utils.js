module.exports = {
  help: ["joke", "chiste", "quote", "frase"],
  tags: ["fun"],
  command: /^(joke|chiste|quote|frase)$/i,
  run: async (m, { command }) => {
    const cmd = command.toLowerCase();

    // 1. Jokes (Chistes)
    if (cmd === "joke" || cmd === "chiste") {
      const chistes = [
        "¿Qué le dice una taza a otra? —¡Qué tazas haciendo!",
        "¿Por qué los pájaros no usan Facebook? —Porque ya tienen Twitter.",
        "¿Cómo se despide un químico? —Ácido un placer.",
        "¿Cuál es el café más peligroso del mundo? —El ex-preso.",
        "¿Qué hace un pez en el agua? —Nada.",
        "¿Por qué los esqueletos no pelean entre sí? —Porque no tienen agallas.",
        "¿Cómo se dice pañuelo en japonés? —Saka-moko.",
        "¿Qué le dice un jaguar a otro? —Jaguar you.",
        "¿Por qué el libro de matemáticas estaba deprimido? —Porque tenía demasiados problemas.",
        "¿Cuál es el colmo de un jardinero? —Que su hija se llame Margarita y la dejen plantada.",
        "¿Qué hace una abeja en el gimnasio? —¡Zumba!",
        "—Papá, ¿qué se siente tener un hijo tan guapo? —No sé, hijo, pregúntale a tu abuelo."
      ];
      const randomJoke = chistes[Math.floor(Math.random() * chistes.length)];
      await m.reply(`*😜 CHISTE DEL DÍA*\n\n${randomJoke}`);
    }

    // 2. Quotes (Frases inspiradoras)
    else if (cmd === "quote" || cmd === "frase") {
      const frases = [
        "“La única manera de hacer un gran trabajo es amar lo que haces.” — Steve Jobs",
        "“La vida es lo que pasa mientras estás ocupado haciendo otros planes.” — John Lennon",
        "“No cuentes los días, haz que los días cuenten.” — Muhammad Ali",
        "“El éxito no es la clave de la felicidad. La felicidad es la clave del éxito.” — Albert Schweitzer",
        "“Cree que puedes y casi lo habrás logrado.” — Theodore Roosevelt",
        "“La vida es 10% lo que te sucede y 90% cómo reaccionas a ello.” — Charles R. Swindoll",
        "“El único modo de descubrir los límites de lo posible es aventurarse un poco más allá, hacia lo imposible.” — Arthur C. Clarke",
        "“No dejes que el ayer ocupe demasiado del hoy.” — Will Rogers",
        "“Tu tiempo es limitado, así que no lo desperdicies viviendo la vida de alguien más.” — Steve Jobs"
      ];
      const randomQuote = frases[Math.floor(Math.random() * frases.length)];
      await m.reply(`*✨ FRASE INSPIRADORA*\n\n${randomQuote}`);
    }
  }
};
