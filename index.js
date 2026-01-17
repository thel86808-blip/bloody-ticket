require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  REST,
  Routes,
  Events,
  ChannelType,
  PermissionsBitField,
  ActivityType
} = require("discord.js");

/* ================= KEEP ALIVE ================= */
const http = require("http");
http.createServer((_, res) => res.end("OK")).listen(3000, () => {
  console.log("🌐 Keep-alive server actief op poort 3000");
});

/* ================= CONFIG ================= */
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = "1451926942055006289";
const GUILD_ID = "1364329816605593781";

const STAFF_ROLES = {
  algemene_vragen: "1451252906908057611",
  sollicitatie: "1426262480761524335",
  klachten: "1451307494205952122",
  wapens: "1451252906908057611",
  refund: "1451252908585783407"
};

const TICKET_CATEGORY_IDS = {
  algemene_vragen: "1379125690166677656",
  sollicitatie: "1379125835298242620",
  klachten: "1379125937798647818",
  wapens: "1451286428767227979",
  refund: "1451603709636378644"
};

const ticketCategories = {
  algemene_vragen: { label: "Algemene Vragen", color: 0x5865F2, prefix: "🔵" },
  sollicitatie: { label: "Sollicitatie", color: 0x2ECC71, prefix: "🟢" },
  klachten: { label: "Klachten", color: 0xE74C3C, prefix: "🔴" },
  wapens: { label: "Wapens", color: 0x9B59B6, prefix: "🟣" },
  refund: { label: "Refund", color: 0xF1C40F, prefix: "🟡" }
};

/* ================= CLIENT ================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

/* ================= SLASH COMMANDS ================= */
const commands = [
  new SlashCommandBuilder().setName("ticket").setDescription("Open het ticket menu"),
  new SlashCommandBuilder().setName("close").setDescription("Sluit dit ticket (staff only)")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Slash commands geregistreerd");
  } catch (err) {
    console.error("💥 Fout bij registeren commands:", err);
  }
})();

/* ================= READY ================= */
client.once(Events.ClientReady, () => {
  console.log(`🤖 Online als ${client.user.tag}`);
  client.user.setActivity({ name: "Murat's Shop", type: ActivityType.Watching });
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    /* ===== /ticket ===== */
    if (interaction.isChatInputCommand() && interaction.commandName === "ticket") {
      await interaction.deferReply(); // direct defer, geen ephemeral

      const embed = new EmbedBuilder()
        .setTitle("🎫 Ticket systeem")
        .setDescription("Klik op een knop om een ticket te openen")
        .setColor(0x5865F2);

      const row = new ActionRowBuilder();
      for (const key in ticketCategories) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_${key}`)
            .setLabel(ticketCategories[key].label)
            .setStyle(ButtonStyle.Primary)
        );
      }

      await interaction.editReply({ embeds: [embed], components: [row] });
      return;
    }

    /* ===== /close ===== */
    if (interaction.isChatInputCommand() && interaction.commandName === "close") {
      if (!interaction.channel) return;
      await interaction.channel.delete().catch(() => {});
      if (!interaction.replied) {
        await interaction.reply({ content: "✅ Ticket gesloten" }).catch(() => {});
      }
      return;
    }

    /* ===== BUTTONS ===== */
    if (interaction.isButton()) {

      // Ticket creation buttons
      if (interaction.customId.startsWith("ticket_")) {
        await interaction.deferReply();

        const key = interaction.customId.replace("ticket_", "");
        const cat = ticketCategories[key];

        const channel = await interaction.guild.channels.create({
          name: `${cat.prefix}-${key}-${interaction.user.username}`.toLowerCase().replace(/ /g, "-"),
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_IDS[key],
          topic: `ticketOwner:${interaction.user.id}`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: STAFF_ROLES[key], allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
          ]
        });

        // Embed in ticket channel
        const ticketEmbed = new EmbedBuilder()
          .setTitle(`🎫 ${cat.label}`)
          .setDescription(`Welkom ${interaction.user}`)
          .setColor(cat.color);

        const closeRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("Sluit ticket")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [ticketEmbed], components: [closeRow] });

        await interaction.editReply({ content: `✅ Ticket aangemaakt: ${channel}` });
        return;
      }

      // Close ticket button
      if (interaction.customId === "close_ticket") {
        if (!interaction.channel) return;
        await interaction.channel.delete().catch(() => {});
        if (!interaction.replied) {
          await interaction.reply({ content: "✅ Ticket gesloten" }).catch(() => {});
        }
        return;
      }
    }
  } catch (err) {
    console.error("💥 Interaction error:", err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: "❌ Er ging iets mis!" }).catch(() => {});
    } else {
      await interaction.reply({ content: "❌ Er ging iets mis!" }).catch(() => {});
    }
  }
});

/* ================= LOGIN ================= */
client.login(TOKEN);
