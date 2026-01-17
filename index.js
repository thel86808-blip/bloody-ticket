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
const TOKEN = process.env.TOKEN;
const CLIENT_ID = "1451926942055006289";
const GUILD_ID = "1364329816605593781";

/* Staff-roles per categorie */
const STAFF_ROLES = {
  "algemene_vragen": "1451252906908057611",
  "sollicitatie": "1426262480761524335",
  "klachten": "1451307494205952122",
  "wapens": "1451252906908057611",
  "refund": "1451252908585783407"
};

/* Category IDs per ticket type */
const TICKET_CATEGORY_IDS = {
  "algemene_vragen": "1379125690166677656",
  "sollicitatie": "1379125835298242620",
  "klachten": "1379125937798647818",
  "wapens": "1451286428767227979",
  "refund": "1451603709636378644"
};

/* ================= CLIENT ================= */
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

/* ================= TICKET CATEGORIES ================= */
const ticketCategories = {
  "algemene_vragen": { label: "Algemene Vragen", color: 0x5865F2, staffRole: STAFF_ROLES.algemene_vragen, categoryId: TICKET_CATEGORY_IDS.algemene_vragen, prefix: "🔵" },
  "sollicitatie": { label: "Sollicitatie", color: 0x2ECC71, staffRole: STAFF_ROLES.sollicitatie, categoryId: TICKET_CATEGORY_IDS.sollicitatie, prefix: "🔵" },
  "klachten": { label: "Klachten", color: 0xE74C3C, staffRole: STAFF_ROLES.klachten, categoryId: TICKET_CATEGORY_IDS.klachten, prefix: "🔴" },
  "wapens": { label: "Wapens Inkoop/Verkoop", color: 0x9B59B6, staffRole: STAFF_ROLES.wapens, categoryId: TICKET_CATEGORY_IDS.wapens, prefix: "🟣" },
  "refund": { label: "Refund", color: 0xF1C40F, staffRole: STAFF_ROLES.refund, categoryId: TICKET_CATEGORY_IDS.refund, prefix: "🟡" }
};

/* ================= TRANSCRIPT ================= */
async function sendTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  let transcript = `Transcript van ${channel.name}\n\n`;
  for (const msg of sorted.values()) {
    transcript += `[${new Date(msg.createdTimestamp).toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
  }

  const ownerId = channel.topic?.split("ticketOwner:")[1];
  if (!ownerId) return;

  try {
    const member = await channel.guild.members.fetch(ownerId);
    await member.send({
      content: "📄 **Hier is je ticket transcript:**",
      files: [{ attachment: Buffer.from(transcript, "utf-8"), name: `${channel.name}-transcript.txt` }]
    });
  } catch {
    console.log("❌ Kon transcript niet DM'en");
  }
}

/* ================= SLASH COMMANDS ================= */
const commands = [
  new SlashCommandBuilder().setName("ticket").setDescription("Open het ticket menu"),
  new SlashCommandBuilder().setName("close").setDescription("Sluit dit ticket (staff only)"),
  new SlashCommandBuilder().setName("add").setDescription("Voeg iemand toe").addUserOption(o => o.setName("user").setDescription("Gebruiker").setRequired(true)),
  new SlashCommandBuilder().setName("remove").setDescription("Verwijder iemand").addUserOption(o => o.setName("user").setDescription("Gebruiker").setRequired(true)),
  new SlashCommandBuilder().setName("rename").setDescription("Hernoem ticket").addStringOption(o => o.setName("naam").setDescription("Nieuwe naam").setRequired(true)),
  new SlashCommandBuilder().setName("move").setDescription("Verplaats ticket").addStringOption(o => o.setName("categorie").setDescription("Categorie ID").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Commands geregistreerd");
  } catch (err) {
    console.error("💥 Fout bij commands registeren:", err);
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

    /* ===== SLASH COMMANDS ===== */
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "ticket") {
        // Direct embed + buttons in channel, **geen ephemeral**
        const embed = new EmbedBuilder()
          .setTitle("📌 Bloody Angels - Tickets")
          .setDescription("Hier kan je tickets openen als je vragen hebt of een sollicitatie wilt doen.\nOpen hier gemakkelijk tickets als je een vraag in de hoofdchat niet kan beantwoorden!")
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

      // STAFF COMMANDS
      const staffOnly = ["close", "add", "remove", "rename", "move"];
      if (staffOnly.includes(interaction.commandName)) {
        if (!interaction.member.roles.cache.hasAny(...Object.values(STAFF_ROLES))) {
          await interaction.reply({ content: "❌ Alleen staff kan dit commando gebruiken." });
          return;
        }
        if (!interaction.channel.topic?.startsWith("ticketOwner:")) {
          await interaction.reply({ content: "❌ Dit is geen ticket." });
          return;
        }

        if (interaction.commandName === "close") {
          await interaction.reply({ content: "⛔ Ticket wordt gesloten..." });
          await sendTranscript(interaction.channel);
          interaction.channel?.delete().catch(() => {});
          return;
        }

        if (interaction.commandName === "add") {
          const user = interaction.options.getUser("user");
          await interaction.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
          await interaction.reply({ content: `✅ ${user} toegevoegd.` });
          return;
        }

        if (interaction.commandName === "remove") {
          const user = interaction.options.getUser("user");
          await interaction.channel.permissionOverwrites.delete(user.id);
          await interaction.reply({ content: `🗑️ ${user} verwijderd.` });
          return;
        }

        if (interaction.commandName === "rename") {
          const naam = interaction.options.getString("naam");
          await interaction.channel.setName(naam);
          await interaction.reply({ content: `✏️ Ticket hernoemd naar **${naam}**` });
          return;
        }

        if (interaction.commandName === "move") {
          const catId = interaction.options.getString("categorie");
          await interaction.channel.setParent(catId);
          await interaction.reply({ content: "📂 Ticket verplaatst." });
          return;
        }
      }
    }

    /* ===== BUTTONS ===== */
    if (interaction.isButton()) {

      // TICKET CREATION
      if (ticketCategories[interaction.customId]) {
        const cat = ticketCategories[interaction.customId];

        const usernameFormatted = interaction.user.username.toLowerCase().replace(/ /g, "-");

        const ticketChannel = await interaction.guild.channels.create({
          name: `${cat.prefix}-${interaction.customId}-${usernameFormatted}`,
          type: ChannelType.GuildText,
          parent: cat.categoryId,
          topic: `ticketOwner:${interaction.user.id}`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: cat.staffRole, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
          ]
        });

        const embed = new EmbedBuilder()
          .setTitle(`🎫 Ticket: ${cat.label}`)
          .setDescription(`📌 **Welkom bij je ticket!**\nWacht hier geduldig af op een reactie.\nTaggen of spam wordt automatisch afgekeurd.\n\n**Categorie:** ${cat.label}\n**Staff Tag:** <@&${cat.staffRole}>\n**Door:** ${interaction.user}\n**Aangemaakt op:** <t:${Math.floor(Date.now() / 1000)}:f>`)
          .setColor(cat.color);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("close_ticket").setLabel("Close").setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ embeds: [embed], components: [row] });

        // MODAL
        const modal = new ModalBuilder().setCustomId(`ticket_modal_${interaction.user.id}`).setTitle("Ticket Formulier");

        const naamInput = new TextInputBuilder().setCustomId("naam").setLabel("Wat is jouw naam").setStyle(TextInputStyle.Short).setRequired(true);
        const leeftijdInput = new TextInputBuilder().setCustomId("leeftijd").setLabel("Wat is jouw leeftijd").setStyle(TextInputStyle.Paragraph).setRequired(true);
        const extraInput = new TextInputBuilder().setCustomId("extra").setLabel("Extra informatie").setStyle(TextInputStyle.Paragraph).setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(naamInput),
          new ActionRowBuilder().addComponents(leeftijdInput),
          new ActionRowBuilder().addComponents(extraInput)
        );

        await interaction.showModal(modal);
        return;
      }

      // CLOSE BUTTON
      if (interaction.customId === "close_ticket") {
        await interaction.reply({ content: "⛔ Ticket wordt gesloten..." });
        await sendTranscript(interaction.channel);
        interaction.channel?.delete().catch(() => {});
        return;
      }
    }

    /* ===== MODAL SUBMISSION ===== */
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal_")) {
      const naam = interaction.fields.getTextInputValue("naam");
      const leeftijd = interaction.fields.getTextInputValue("leeftijd");
      const extra = interaction.fields.getTextInputValue("extra") || "Geen extra info";

      const embed = new EmbedBuilder()
        .setTitle("💬 Antwoorden Ticket Formulier")
        .addFields(
          { name: "Wat is jouw naam", value: naam, inline: false },
          { name: "Wat is jouw leeftijd", value: leeftijd, inline: false },
          { name: "Extra informatie", value: extra, inline: false }
        )
        .setColor(0x00FF00);

      const ticketChannel = interaction.guild.channels.cache.find(ch => ch.topic === `ticketOwner:${interaction.user.id}`);
      if (ticketChannel) await ticketChannel.send({ embeds: [embed] });

      await interaction.reply({ content: "✅ Formulier verzonden naar je ticketkanaal!" });
    }

  } catch (err) {
    console.error("💥 Interactie error:", err);
  }
});

/* ================= LOGIN ================= */
client.login(TOKEN);
