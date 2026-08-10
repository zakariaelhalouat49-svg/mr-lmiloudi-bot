require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  AuditLogEvent,
  EmbedBuilder,
  ChannelType,
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const LOG_CATEGORY = "📋・LOGS";

const LOG_CHANNELS = {
  memberJoin: "👤・member-join",
  memberLeave: "🚪・member-leave",
  memberUpdate: "📝・member-update",
  messageDelete: "💬・message-delete",
  messageEdit: "✏️・message-edit",
  moderation: "🛡️・moderation",
  ban: "🔨・ban-logs",
  kick: "👢・kick-logs",
  timeout: "⏱️・timeout-logs",
  warn: "⚠️・warn-logs",
  voiceMember: "🎙️・voice-member",
  voiceMove: "↔️・voice-move",
  voiceDisconnect: "❌・voice-disconnect",
  role: "🎭・role-logs",
  channel: "📁・channel-logs",
  category: "🗂️・category-logs",
  invite: "🔗・invite-logs",
  bot: "🤖・bot-logs",
  server: "⚙️・server-logs",
};

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} is online!`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await createLogs(guild);
      console.log(`📋 Logs ready in ${guild.name}`);
    } catch (error) {
      console.error("❌ LOG ERROR:", error);
    }
  }
});

async function createLogs(guild) {
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

    console.log("✅ LOG CATEGORY CREATED");
  }

  for (const name of Object.values(LOG_CHANNELS)) {
    const exists = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.name === name &&
        channel.parentId === category.id
    );

    if (exists) continue;

    await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
    });

    console.log(`✅ CREATED: ${name}`);
  }
}

function getLog(guild, type) {
  const name = LOG_CHANNELS[type];

  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name === name
  );
}

async function log(guild, type, embed) {
  const channel = getLog(guild, type);

  if (!channel) return;

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("❌ SEND LOG ERROR:", error);
  }
}

// MEMBER JOIN
client.on("guildMemberAdd", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("👤 Member Joined")
    .addFields(
      { name: "User", value: member.user.tag },
      { name: "ID", value: member.id }
    )
    .setTimestamp();

  await log(member.guild, "memberJoin", embed);
});

// MEMBER LEAVE
client.on("guildMemberRemove", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("🚪 Member Left")
    .addFields(
      { name: "User", value: member.user.tag },
      { name: "ID", value: member.id }
    )
    .setTimestamp();

  await log(member.guild, "memberLeave", embed);
});

// MESSAGE DELETE
client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;

  const embed = new EmbedBuilder()
    .setTitle("💬 Message Deleted")
    .addFields(
      {
        name: "User",
        value: message.author?.tag || "Unknown",
      },
      {
        name: "Channel",
        value: `<#${message.channel.id}>`,
      },
      {
        name: "Content",
        value: message.content?.slice(0, 1024) || "Unknown",
      }
    )
    .setTimestamp();

  await log(message.guild, "messageDelete", embed);
});

// MESSAGE EDIT
client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!oldMessage.guild) return;
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Message Edited")
    .addFields(
      {
        name: "User",
        value: oldMessage.author?.tag || "Unknown",
      },
      {
        name: "Channel",
        value: `<#${oldMessage.channel.id}>`,
      },
      {
        name: "Before",
        value: oldMessage.content?.slice(0, 1024) || "Empty",
      },
      {
        name: "After",
        value: newMessage.content?.slice(0, 1024) || "Empty",
      }
    )
    .setTimestamp();

  await log(oldMessage.guild, "messageEdit", embed);
});

// VOICE
client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  const member = newState.member || oldState.member;

  if (!member) return;

  // JOIN
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setTitle("🎙️ Voice Join")
      .addFields(
        { name: "User", value: `${member.user.tag}\n${member.id}` },
        {
          name: "Channel",
          value: newState.channel?.name || "Unknown",
        }
      )
      .setTimestamp();

    await log(guild, "voiceMember", embed);
    return;
  }

  // LEAVE / DISCONNECT
  if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setTitle("🎙️ Voice Leave")
      .addFields(
        { name: "User", value: `${member.user.tag}\n${member.id}` },
        {
          name: "Channel",
          value: oldState.channel?.name || "Unknown",
        }
      )
      .setTimestamp();

    await log(guild, "voiceMember", embed);

    setTimeout(async () => {
      try {
        const audit = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberDisconnect,
          limit: 10,
        });

        const entry = audit.entries.find(
          (e) =>
            e.target?.id === member.id &&
            Date.now() - e.createdTimestamp < 5000
        );

        if (!entry) return;

        const embed = new EmbedBuilder()
          .setTitle("❌ Voice Disconnect")
          .addFields(
            {
              name: "User",
              value: `${member.user.tag}\n${member.id}`,
            },
            {
              name: "Channel",
              value: oldState.channel?.name || "Unknown",
            },
            {
              name: "Disconnected By",
              value: `${entry.executor?.tag || "Unknown"}\n${
                entry.executor?.id || "Unknown"
              }`,
            }
          )
          .setTimestamp();

        await log(guild, "voiceDisconnect", embed);
      } catch (error) {
        console.error("❌ DISCONNECT ERROR:", error);
      }
    }, 1500);

    return;
  }

  // MOVE
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    setTimeout(async () => {
      try {
        const audit = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberMove,
          limit: 10,
        });

        const entry = audit.entries.find(
          (e) =>
            e.target?.id === member.id &&
            Date.now() - e.createdTimestamp < 5000
        );

        const embed = new EmbedBuilder()
          .setTitle("↔️ Voice Move")
          .addFields(
            {
              name: "User",
              value: `${member.user.tag}\n${member.id}`,
            },
            {
              name: "From",
              value: oldState.channel?.name || "Unknown",
            },
            {
              name: "To",
              value: newState.channel?.name || "Unknown",
            },
            {
              name: "Moved By",
              value: `${entry?.executor?.tag || "Unknown"}\n${
                entry?.executor?.id || "Unknown"
              }`,
            }
          )
          .setTimestamp();

        await log(guild, "voiceMove", embed);
      } catch (error) {
        console.error("❌ MOVE ERROR:", error);
      }
    }, 1500);
  }
});

// ROLE CREATE
client.on("roleCreate", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role Created")
    .addFields(
      { name: "Role", value: role.name },
      { name: "ID", value: role.id }
    )
    .setTimestamp();

  await log(role.guild, "role", embed);
});

// ROLE DELETE
client.on("roleDelete", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role Deleted")
    .addFields(
      { name: "Role", value: role.name },
      { name: "ID", value: role.id }
    )
    .setTimestamp();

  await log(role.guild, "role", embed);
});

// CHANNEL CREATE
client.on("channelCreate", async (channel) => {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("📁 Channel Created")
    .addFields(
      { name: "Channel", value: channel.name },
      { name: "ID", value: channel.id }
    )
    .setTimestamp();

  await log(channel.guild, "channel", embed);
});

// CHANNEL DELETE
client.on("channelDelete", async (channel) => {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("📁 Channel Deleted")
    .addFields(
      { name: "Channel", value: channel.name },
      { name: "ID", value: channel.id }
    )
    .setTimestamp();

  await log(channel.guild, "channel", embed);
});

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing!");
  process.exit(1);
}

client.login(process.env.TOKEN);