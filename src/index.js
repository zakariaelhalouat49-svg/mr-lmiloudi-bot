require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  AuditLogEvent,
  EmbedBuilder,
  PermissionsBitField,
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

// =========================
// LOG CHANNELS
// =========================

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

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} is online!`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await setupLogs(guild);
      console.log(`📋 Logs ready in: ${guild.name}`);
    } catch (error) {
      console.error(`❌ Could not setup logs in ${guild.name}:`, error);
    }
  }
});

// =========================
// CREATE LOG SYSTEM
// =========================

async function setupLogs(guild) {
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
  }

  for (const channelName of Object.values(LOG_CHANNELS)) {
    let channel = guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText &&
        ch.name === channelName &&
        ch.parentId === category.id
    );

    if (!channel) {
      await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
        ],
      });
    }
  }
}

// =========================
// GET LOG CHANNEL
// =========================

function getLogChannel(guild, name) {
  const channelName = LOG_CHANNELS[name];

  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name === channelName
  );
}

// =========================
// SEND LOG
// =========================

async function sendLog(guild, channelName, embed) {
  const channel = getLogChannel(guild, channelName);

  if (!channel) return;

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`❌ Could not send ${channelName} log:`, error);
  }
}

// =========================
// MEMBER JOIN
// =========================

client.on("guildMemberAdd", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("👤 Member Joined")
    .addFields(
      {
        name: "User",
        value: `${member.user.tag}`,
        inline: true,
      },
      {
        name: "ID",
        value: member.id,
        inline: true,
      }
    )
    .setTimestamp();

  await sendLog(member.guild, "memberJoin", embed);
});

// =========================
// MEMBER LEAVE
// =========================

client.on("guildMemberRemove", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("🚪 Member Left")
    .addFields(
      {
        name: "User",
        value: `${member.user.tag}`,
        inline: true,
      },
      {
        name: "ID",
        value: member.id,
        inline: true,
      }
    )
    .setTimestamp();

  await sendLog(member.guild, "memberLeave", embed);
});

// =========================
// MEMBER UPDATE
// =========================

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  const changes = [];

  if (oldMember.nickname !== newMember.nickname) {
    changes.push(
      `**Nickname:** ${oldMember.nickname || "None"} → ${
        newMember.nickname || "None"
      }`
    );
  }

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const addedRoles = newRoles.filter((role) => !oldRoles.has(role.id));
  const removedRoles = oldRoles.filter((role) => !newRoles.has(role.id));

  if (addedRoles.size > 0) {
    changes.push(
      `**Role Added:** ${addedRoles.map((r) => r.name).join(", ")}`
    );
  }

  if (removedRoles.size > 0) {
    changes.push(
      `**Role Removed:** ${removedRoles.map((r) => r.name).join(", ")}`
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

// =========================
// MESSAGE DELETE
// =========================

client.on("messageDelete", async (message) => {
  if (!message.guild || message.author?.bot) return;

  const embed = new EmbedBuilder()
    .setTitle("💬 Message Deleted")
    .addFields(
      {
        name: "Author",
        value: `${message.author?.tag || "Unknown"}\n${
          message.author?.id || "Unknown"
        }`,
      },
      {
        name: "Channel",
        value: `<#${message.channel.id}>`,
      },
      {
        name: "Content",
        value: message.content
          ? message.content.slice(0, 1024)
          : "No text content",
      }
    )
    .setTimestamp();

  await sendLog(message.guild, "messageDelete", embed);
});

// =========================
// MESSAGE EDIT
// =========================

client.on("messageUpdate", async (oldMessage, newMessage) => {
  if (!oldMessage.guild) return;
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Message Edited")
    .addFields(
      {
        name: "Author",
        value: `${oldMessage.author?.tag || "Unknown"}\n${
          oldMessage.author?.id || "Unknown"
        }`,
      },
      {
        name: "Channel",
        value: `<#${oldMessage.channel.id}>`,
      },
      {
        name: "Before",
        value: oldMessage.content
          ? oldMessage.content.slice(0, 1024)
          : "Empty",
      },
      {
        name: "After",
        value: newMessage.content
          ? newMessage.content.slice(0, 1024)
          : "Empty",
      }
    )
    .setTimestamp();

  await sendLog(oldMessage.guild, "messageEdit", embed);
});

// =========================
// VOICE SYSTEM
// =========================

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
          value: `${newState.channel.name}`,
        }
      )
      .setTimestamp();

    await sendLog(guild, "voiceMember", embed);
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
          value: `${oldState.channel.name}`,
        }
      )
      .setTimestamp();

    await sendLog(guild, "voiceMember", embed);

    // Check audit log for disconnect
    setTimeout(async () => {
      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberDisconnect,
          limit: 5,
        });

        const entry = logs.entries.find(
          (entry) =>
            entry.target?.id === member.id &&
            Date.now() - entry.createdTimestamp < 5000
        );

        if (!entry) return;

        const executor = entry.executor;

        const disconnectEmbed = new EmbedBuilder()
          .setTitle("❌ Voice Disconnect")
          .addFields(
            {
              name: "User",
              value: `${member.user.tag}\n${member.id}`,
            },
            {
              name: "Channel",
              value: `${oldState.channel.name}`,
            },
            {
              name: "Disconnected By",
              value: `${executor?.tag || "Unknown"}\n${
                executor?.id || "Unknown"
              }`,
            }
          )
          .setTimestamp();

        await sendLog(guild, "voiceDisconnect", disconnectEmbed);
      } catch (error) {
        console.error("❌ Disconnect audit log error:", error);
      }
    }, 1000);

    return;
  }

  // MOVE
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    const embed = new EmbedBuilder()
      .setTitle("↔️ Voice Move")
      .addFields(
        {
          name: "User",
          value: `${member.user.tag}\n${member.id}`,
        },
        {
          name: "From",
          value: `${oldState.channel.name}`,
        },
        {
          name: "To",
          value: `${newState.channel.name}`,
        }
      )
      .setTimestamp();

    await sendLog(guild, "voiceMove", embed);

    // Find executor
    setTimeout(async () => {
      try {
        const logs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberMove,
          limit: 5,
        });

        const entry = logs.entries.find(
          (entry) =>
            entry.target?.id === member.id &&
            Date.now() - entry.createdTimestamp < 5000
        );

        if (!entry) return;

        const executor = entry.executor;

        const executorEmbed = new EmbedBuilder()
          .setTitle("👮 Voice Move — Action")
          .addFields(
            {
              name: "User",
              value: `${member.user.tag}\n${member.id}`,
            },
            {
              name: "From",
              value: `${oldState.channel.name}`,
            },
            {
              name: "To",
              value: `${newState.channel.name}`,
            },
            {
              name: "Moved By",
              value: `${executor?.tag || "Unknown"}\n${
                executor?.id || "Unknown"
              }`,
            }
          )
          .setTimestamp();

        await sendLog(guild, "voiceMove", executorEmbed);
      } catch (error) {
        console.error("❌ Move audit log error:", error);
      }
    }, 1000);
  }
});

// =========================
// ROLE CREATE / DELETE
// =========================

client.on("roleCreate", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role Created")
    .addFields(
      {
        name: "Role",
        value: `${role.name}`,
      },
      {
        name: "ID",
        value: role.id,
      }
    )
    .setTimestamp();

  await sendLog(role.guild, "role", embed);
});

client.on("roleDelete", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("🎭 Role Deleted")
    .addFields(
      {
        name: "Role",
        value: `${role.name}`,
      },
      {
        name: "ID",
        value: role.id,
      }
    )
    .setTimestamp();

  await sendLog(role.guild, "role", embed);
});

// =========================
// CHANNEL CREATE
// =========================

client.on("channelCreate", async (channel) => {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("📁 Channel Created")
    .addFields(
      {
        name: "Channel",
        value: `${channel.name}`,
      },
      {
        name: "ID",
        value: channel.id,
      }
    )
    .setTimestamp();

  await sendLog(channel.guild, "channel", embed);
});

// =========================
// CHANNEL DELETE
// =========================

client.on("channelDelete", async (channel) => {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("📁 Channel Deleted")
    .addFields(
      {
        name: "Channel",
        value: `${channel.name}`,
      },
      {
        name: "ID",
        value: channel.id,
      }
    )
    .setTimestamp();

  await sendLog(channel.guild, "channel", embed);
});

// =========================
// LOGIN
// =========================

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing!");
  process.exit(1);
}

client.login(process.env.TOKEN);