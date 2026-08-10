require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const LOG_CATEGORY = "📋・LOGS";

const LOG_CHANNELS = [
  "👤・member-join",
  "🚪・member-leave",
  "📝・member-update",
  "💬・message-delete",
  "✏️・message-edit",
  "🛡️・moderation",
  "🔨・ban-logs",
  "👢・kick-logs",
  "⏱️・timeout-logs",
  "⚠️・warn-logs",
  "🔊・voice-logs",
  "↔️・voice-move",
  "❌・voice-disconnect",
  "🎭・role-logs",
  "📁・channel-logs",
  "🗂️・category-logs",
  "🔗・invite-logs",
  "🤖・bot-logs",
  "⚙️・server-logs",
];

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} is online!`);

  for (const guild of client.guilds.cache.values()) {
    console.log(`🔎 Setting up logs in: ${guild.name}`);

    try {
      let category = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildCategory &&
          channel.name === LOG_CATEGORY
      );

      if (!category) {
        category = await guild.channels.create({
          name: LOG_CATEGORY,
          type: ChannelType.GuildCategory,
        });

        console.log(`✅ Created category: ${LOG_CATEGORY}`);
      } else {
        console.log(`✔️ Category already exists`);
      }

      for (const name of LOG_CHANNELS) {
        const exists = guild.channels.cache.find(
          (channel) =>
            channel.type === ChannelType.GuildText &&
            channel.name === name &&
            channel.parentId === category.id
        );

        if (exists) {
          console.log(`✔️ Exists: ${name}`);
          continue;
        }

        await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
          ],
        });

        console.log(`✅ Created: ${name}`);
      }

      console.log(`🎉 LOG SYSTEM READY: ${guild.name}`);
    } catch (error) {
      console.error(`❌ LOG SETUP ERROR:`, error);
    }
  }
});

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing!");
  process.exit(1);
}

client.login(process.env.TOKEN);