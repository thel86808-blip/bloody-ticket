require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  Events,
  ChannelType,
  PermissionsBitField,
  ActivityType
} = require("discord.js");

/* ================= CONFIG ================= */
const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) throw new Error("❌ DISCORD_TOKEN ontbreekt");

console.log(
  "TOKEN START:",
  process.env.DISCORD_TOKEN?.slice(0, 15)
);

const CLIENT_ID = "1451926942055006289";
const GUILD_ID = "1364329816605593781";

/* ================= KEEP ALIVE (Render) ================= */
const http = require("http");
http.createServer((_, res) => {
  res.writeHead(200);
  res.end("Bot is alive");
}).listen(3000, () => {
  console.log("🌐 Keep-alive server actief");
});

/* ================= STAFF ROLES ================= */
const STAFF_ROLES = {
  algemene_vragen: "1451252906908057611",
  sollicitatie: "1426262480761524335",
  klachten: "1451307494205952122",
  wapens: "1451252906908057611",
  refund: "1451252908585783407"
};

/* ================= TICKET CATEGORIES ================= */
const ticketCategories = {
  algemene_vragen: {
    label: "Algemene Vragen",
    color: 0x5865F2,
    categoryId: "1379125690166677656",
    prefix: "🔵",
    staffRole: STAFF_ROLES.algemene_vragen
  },
  sollicitatie: {
    label: "Sollicitatie",
    color: 0x2ECC71,
    categoryId: "1379125835298242620",
    prefix: "🟢",
    staffRole: STAFF_ROLES.sollicitatie
  },
  klachten: {
    label: "Klachten",
    color: 0xE74C3C,
    categoryId: "1379125937798647818",
    prefix: "🔴",
    staffRole: STAFF_ROLES.klachten
  },
  wapens: {
    label: "Wapens",
    color: 0x9B59B6,
    categoryId: "1451286428767227979",
    prefix: "🟣",
    staffRole: STAFF_ROLES.wapens
  },
  refund: {
    label: "Refund",
    color: 0xF1C40F,
    categoryId: "1451603709636378644",
    prefix: "🟡",
    staffRole: STAFF_ROLES.refund
  }
};

/* ================= CLIENT ================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ================= SLASH COMMANDS ================= */
const commands = [
  new SlashCommandBuilder().setName("ticket").setDescription("Open het ticket menu"),
  new SlashCommandBuilder().setName("close").setDescription("Sluit dit ticket"),
  new SlashCommandBuilder()
    .setName("add")
    .setDescription("Voeg iemand toe")
    .addUserOption(o => o.setName("user").setDescription("Gebruiker").setRequired(true)),
  new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Verwijder iemand")
    .addUserOption(o => o.setName("user").setDescription("Gebruiker").setRequired(true))
].map(c => c.toJSON());

/* ================= REGISTER COMMANDS ================= */
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands geregistreerd");
  } catch (err) {
    console.error("❌ Slash command error:", err);
  }
})();

/* ================= READY ================= */
client.once(Events.ClientReady, c => {
  console.log(`🤖 Online als ${c.user.tag}`);
  c.user.setActivity({ name: "Murat's Shop", type: ActivityType.Watching });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  /* ===== SLASH COMMAND ===== */
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "ticket") {
      await interaction.reply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🎫 Bloody Angels Tickets")
        .setDescription("Kies een categorie om een ticket te openen")
        .setColor(0x5865F2);

      const row = new ActionRowBuilder();
      for (const key in ticketCategories) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(key)
            .setLabel(ticketCategories[key].label)
            .setStyle(ButtonStyle.Primary)
        );
      }

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return;
    }

    /* ===== STAFF COMMANDS ===== */
    const staffCmds = ["close", "add", "remove"];
    if (staffCmds.includes(interaction.commandName)) {

      if (!interaction.member.roles.cache.hasAny(...Object.values(STAFF_ROLES))) {
        return interaction.reply({ content: "❌ Alleen staff.", ephemeral: true });
      }

      if (!interaction.channel.topic?.startsWith("ticketOwner:")) {
        return interaction.reply({ content: "❌ Dit is geen ticket.", ephemeral: true });
      }

      if (interaction.commandName === "close") {
        await interaction.reply({ content: "⛔ Ticket gesloten.", ephemeral: true });
        return interaction.channel.delete().catch(() => {});
      }

      const user = interaction.options.getUser("user");

      if (interaction.commandName === "add") {
        await interaction.channel.permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true
        });
        return interaction.reply({ content: `✅ ${user} toegevoegd`, ephemeral: true });
      }

      if (interaction.commandName === "remove") {
        await interaction.channel.permissionOverwrites.delete(user.id);
        return interaction.reply({ content: `🗑️ ${user} verwijderd`, ephemeral: true });
      }
    }
  }

  /* ===== BUTTONS ===== */
  if (interaction.isButton()) {
    const cat = ticketCategories[interaction.customId];
    if (!cat) return;

    const existing = interaction.guild.channels.cache.find(
      ch => ch.topic === `ticketOwner:${interaction.user.id}`
    );
    if (existing) {
      return interaction.reply({
        content: "❌ Je hebt al een open ticket.",
        ephemeral: true
      });
    }

    const username = interaction.user.username
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .slice(0, 20);

    const channel = await interaction.guild.channels.create({
      name: `${cat.prefix}-${username}`,
      type: ChannelType.GuildText,
      parent: cat.categoryId,
      topic: `ticketOwner:${interaction.user.id}`,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: cat.staffRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🎫 ${cat.label}`)
          .setDescription(`Welkom ${interaction.user}`)
          .setColor(cat.color)
      ]
    });

    await interaction.reply({ content: "✅ Ticket aangemaakt!", ephemeral: true });
  }
});

/* ================= LOGIN ================= */
client.login(TOKEN);



