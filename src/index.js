require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  AuditLogEvent,
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

  voice: "🔊・voice-logs",
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

  console.log(`🏠 Servers found: ${client.guilds.cache.size}`);

  for (const guild of client.guilds.cache.values()) {
    console.log(`🔎 Setting up logs in: ${guild.name} (${guild.id})`);

    try {
      await setupLogs(guild);
      console.log(`✅ LOGS FINISHED: ${guild.name}`);
    } catch (error) {
      console.error(`❌ LOG SETUP ERROR:`, error);
    }
  }
});

async function setupLogs(guild) {
  console.log(`📋 Checking LOG category in ${guild.name}...`);

  let category = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildCategory &&
      channel.name === LOG_CATEGORY
  );

  if (!category) {
    console.log("📁 Creating LOG category...");

    category = await guild.channels.create({
      name: LOG_CATEGORY,
      type: ChannelType.GuildCategory,
    });

    console.log(`✅ Category created: ${category.name}`);
  } else {
    console.log("✅ LOG category already exists");
  }

  for (const [key, channelName] of Object.entries(LOG_CHANNELS)) {
    const existing = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.name === channelName &&
        channel.parentId === category.id
    );

    if (existing) {
      console.log(`✔️ Already exists: ${channelName}`);
      continue;
    }

    try {
      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
      });

      console.log(`✅ Created: ${channel.name}`);
    } catch (error) {
      console.error(`❌ Cannot create ${channelName}:`, error);
    }
  }
}

function getLogChannel(guild, type) {
  const channelName = LOG_CHANNELS[type];

  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name === channelName
  );
}

async function sendLog(guild, type, embed) {
  const channel = getLogChannel(guild, type);

  if (!channel) {
    console.log(`⚠️ Log channel not found: ${type}`);
    return;
  }

  try {
    await channel.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error(`❌ Could not send ${type} log:`, error);
  }
}

// ==========================
// MEMBER JOIN
// ==========================

client.on("guildMemberAdd", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("👤 Member Joined")
    .addFields(
      {
        name: "User",
        value: `${member.user.tag}`,
      },
      {
        name: "ID",
        value: member.id,
      }
    )
    .setTimestamp();

  await sendLog(member.guild, "memberJoin", embed);
});

// ==========================
// MEMBER LEAVE
// ==========================

client.on("guildMemberRemove", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("🚪 Member Left")
    .addFields(
      {
        name: "User",
        value: `${member.user.tag}`,
      },
      {
        name: "ID",
        value: member.id,
      }
    )
    .setTimestamp();

  await sendLog(member.guild, "memberLeave", embed);
});

// ==========================
// MEMBER UPDATE
// ==========================

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const changes = [];

  if (oldMember.nickname !== newMember.nickname) {
    changes.push(
      `Nickname: ${oldMember.nickname || "None"} → ${
        newMember.nickname || "None"
      }`
    );
  }

  const addedRoles = newMember.roles.cache.filter(
    (role) => !oldMember.roles.cache.has(role.id)
  );

  const removedRoles = oldMember.roles.cache.filter(
    (role) => !newMember.roles.cache.has(role.id)
  );

  if (addedRoles.size > 0) {
    changes.push(
      `Role Added: ${addedRoles.map((role) => role.name).join(", ")}`
    );
  }

  if (removedRoles.size > 0) {
    changes.push(
      `Role Removed: ${removedRoles.map((role) => role.name).join(", ")}`
    );
  }

  if (changes.length === 0) return;

  const embed = new EmbedBuilder()
    .setTitle("📝 Member Updated")
    .setDescription(changes.join("\n"))
    .addFields({
      name: "User",
      value: `${newMember.user.tag}\n${newMember.id}`,
    })
    .setTimestamp();

  await sendLog(newMember.guild, "memberUpdate", embed);
});

// ==========================
// MESSAGE DELETE
// ==========================

client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;

  const embed = new EmbedBuilder()
    .setTitle("💬 Message Deleted")
    .addFields(
      {
        name: "User",
        value: `${message.author?.tag || "Unknown"}`,
      },
      {
        name: "Channel",
        value: `<#${message.channel.id}>`,
      },
      {
        name: "Content",
        value: message.content
          ? message.content.substring(0, 1024)
          : "No content",
      }
    )
    .setTimestamp();

  await sendLog(message.guild, "messageDelete", embed);
});

// ==========================
// MESSAGE EDIT
// ==========================

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!oldMessage.guild) return;
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Message Edited")
    .addFields(
      {
        name: "User",
        value: `${oldMessage.author?.tag || "Unknown"}`,
      },
      {
        name: "Channel",
        value: `<#${oldMessage.channel.id}>`,
      },
      {
        name: "Before",
        value: oldMessage.content
          ? oldMessage.content.substring(0, 1024)
          : "Empty",
      },
      {
        name: "After",
        value: newMessage.content
          ? newMessage.content.substring(0, 1024)
          : "Empty",
      }
    )
    .setTimestamp();

  await sendLog(oldMessage.guild, "messageEdit", embed);
});

// ==========================
// VOICE
// ==========================

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  const member = newState.member || oldState.member;

  if (!member) return;

  // JOIN
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setTitle("🎙️ Voice Join")
      .addFields(
        {
          name: "User",
          value: `${member.user.tag}\n${member.id}`,
        },
        {
          name: "Channel",
          value: newState.channel?.name || "Unknown",
        }
      )
      .setTimestamp();

    await sendLog(guild, "voice", embed);

    return;
  }

  // LEAVE
  if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setTitle("🎙️ Voice Leave")
      .addFields(
        {
          name: "User",
          value: `${member.user.tag}\n${member.id}`,
        },
        {
          name: "Channel",
          value: oldState.channel?.name || "Unknown",
        }
      )
      .setTimestamp();

    await sendLog(guild, "voice", embed);

    // CHECK DISCONNECT
    setTimeout(async () => {
      try {
        const audit = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberDisconnect,
          limit: 10,
        });

        const entry = audit.entries.find(
          (entry) =>
            entry.target?.id === member.id &&
            Date.now() - entry.createdTimestamp < 5000
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

        await sendLog(guild, "voiceDisconnect", embed);
      } catch (error) {
        console.error("❌ Disconnect audit error:", error);
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
          (entry) =>
            entry.target?.id === member.id &&
            Date.now() - entry.createdTimestamp < 5000
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

        await sendLog(guild, "voiceMove", embed);
      } catch (error) {
        console.error("❌ Move audit error:", error);
      }
    }, 1500);
  }
});

// ==========================
// ROLE CREATE
// ==========================

client.on("roleCreate", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role Created")
    .addFields(
      {
        name: "Role",
        value: role.name,
      },
      {
        name: "ID",
        value: role.id,
      }
    )
    .setTimestamp();

  await sendLog(role.guild, "role", embed);
});

// ==========================
// ROLE DELETE
// ==========================

client.on("roleDelete", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role Deleted")
    .addFields(
      {
        name: "Role",
        value: role.name,
      },
      {
        name: "ID",
        value: role.id,
      }
    )
    .setTimestamp();

  await sendLog(role.guild, "role", embed);
});

// ==========================
// CHANNEL CREATE
// ==========================

client.on("channelCreate", async (channel) => {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("📁 Channel Created")
    .addFields(
      {
        name: "Channel",
        value: channel.name,
      },
      {
        name: "ID",
        value: channel.id,
      }
    )
    .setTimestamp();

  await sendLog(channel.guild, "channel", embed);
});

// ==========================
// CHANNEL DELETE
// ==========================

client.on("channelDelete", async (channel) => {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("📁 Channel Deleted")
    .addFields(
      {
        name: "Channel",
        value: channel.name,
      },
      {
        name: "ID",
        value: channel.id,
      }
    )
    .setTimestamp();

  await sendLog(channel.guild, "channel", embed);
});

// ==========================
// LOGIN
// ==========================

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing!");
  process.exit(1);
}

client.login(process.env.TOKEN);