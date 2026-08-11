const path = require("path");
const dotenv = require("dotenv");

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

dotenv.config({
  path: path.join(__dirname, ".env"),
});

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing from src/.env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// =========================
// LOG NAMES
// =========================

const LOG_CATEGORY = "LOGS";

const LOG_CHANNELS = {
  memberJoin: "member-join",
  memberLeave: "member-leave",
  memberUpdate: "member-update",

  messageDelete: "message-delete",
  messageEdit: "message-edit",

  moderation: "moderation",
  ban: "ban-logs",
  kick: "kick-logs",
  timeout: "timeout-logs",
  warn: "warn-logs",

  voiceMember: "voice-member",
  voiceMove: "voice-move",
  voiceDisconnect: "voice-disconnect",

  role: "role-logs",
  channel: "channel-logs",
  category: "category-logs",

  invite: "invite-logs",
  bot: "bot-logs",
  server: "server-logs",
};

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log(`OK ${client.user.tag} is online!`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await setupLogs(guild);
      console.log(`Logs ready in: ${guild.name}`);
    } catch (error) {
      console.error(`Could not setup logs in ${guild.name}:`, error);
    }
  }
});

// =========================
// SETUP LOGS
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
    const exists = guild.channels.cache.find(
      (channel) =>
        channel.type === ChannelType.GuildText &&
        channel.name === channelName &&
        channel.parentId === category.id
    );

    if (!exists) {
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

function getLogChannel(guild, type) {
  const channelName = LOG_CHANNELS[type];

  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText &&
      channel.name === channelName
  );
}

// =========================
// SEND LOG
// =========================

async function sendLog(guild, type, embed) {
  const channel = getLogChannel(guild, type);

  if (!channel) return;

  try {
    await channel.send({
      embeds: [embed],
    });
  } catch (error) {
    console.error(`Could not send ${type} log:`, error);
  }
}

// =========================
// MEMBER JOIN
// =========================

client.on("guildMemberAdd", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("Member Joined")
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
    .setTitle("Member Left")
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
      `Nickname: ${oldMember.nickname || "None"} -> ${
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
    .setTitle("Member Updated")
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
    .setTitle("Message Deleted")
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
    .setTitle("Message Edited")
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
// VOICE
// =========================

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  const member = newState.member || oldState.member;

  if (!member) return;

  // JOIN
  if (!oldState.channelId && newState.channelId) {
    const embed = new EmbedBuilder()
      .setTitle("Voice Join")
      .addFields(
        {
          name: "User",
          value: `${member.user.tag}\n${member.id}`,
        },
        {
          name: "Channel",
          value: newState.channel
            ? newState.channel.name
            : "Unknown",
        }
      )
      .setTimestamp();

    await sendLog(guild, "voiceMember", embed);
    return;
  }

  // LEAVE
  if (oldState.channelId && !newState.channelId) {
    const embed = new EmbedBuilder()
      .setTitle("Voice Leave")
      .addFields(
        {
          name: "User",
          value: `${member.user.tag}\n${member.id}`,
        },
        {
          name: "Channel",
          value: oldState.channel
            ? oldState.channel.name
            : "Unknown",
        }
      )
      .setTimestamp();

    await sendLog(guild, "voiceMember", embed);
    return;
  }

  // MOVE
  if (
    oldState.channelId &&
    newState.channelId &&
    oldState.channelId !== newState.channelId
  ) {
    const embed = new EmbedBuilder()
      .setTitle("Voice Move")
      .addFields(
        {
          name: "User",
          value: `${member.user.tag}\n${member.id}`,
        },
        {
          name: "From",
          value: oldState.channel
            ? oldState.channel.name
            : "Unknown",
        },
        {
          name: "To",
          value: newState.channel
            ? newState.channel.name
            : "Unknown",
        }
      )
      .setTimestamp();

    await sendLog(guild, "voiceMove", embed);
  }
});

// =========================
// ROLE CREATE
// =========================

client.on("roleCreate", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("Role Created")
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

// =========================
// ROLE DELETE
// =========================

client.on("roleDelete", async (role) => {
  const embed = new EmbedBuilder()
    .setTitle("Role Deleted")
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

// =========================
// CHANNEL CREATE
// =========================

client.on("channelCreate", async (channel) => {
  if (!channel.guild) return;

  const embed = new EmbedBuilder()
    .setTitle("Channel Created")
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

// =========================
// CHANNEL DELETE
// =========================
// =========================
// NEED HELP SYSTEM
// =========================

const NEED_HELP_VC_ID = "1534415387633127595";
const NEED_HELP_CATEGORY_ID = "1534392565346996328";
const NEED_HELP_ALERT_CHANNEL_ID = "1535097156426399785";

const NEED_HELP_STAFF_ROLES = [
  "1534392631566667856",
  "1535096220278718536",
];

// =========================
// CREATE HELP VC
// =========================

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const guild = newState.guild || oldState.guild;
    const member = newState.member || oldState.member;

    if (!guild || !member || member.user.bot) return;

    // =========================
    // USER ENTERED NEED HELP
    // =========================

    if (
      newState.channelId === NEED_HELP_VC_ID &&
      oldState.channelId !== NEED_HELP_VC_ID
    ) {
      const category = await guild.channels
        .fetch(NEED_HELP_CATEGORY_ID)
        .catch(() => null);

      if (!category) {
        console.error("❌ Need Help category not found.");
        return;
      }

      // Get staff roles
      const staffRoles = [];

      for (const roleId of NEED_HELP_STAFF_ROLES) {
        const role = await guild.roles.fetch(roleId).catch(() => null);

        if (role) {
          staffRoles.push(role);
        }
      }

      // Permissions
      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
          ],
        },

        // User
        {
          id: member.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
            PermissionsBitField.Flags.Stream,
          ],
        },
      ];

      // Staff
      for (const role of staffRoles) {
        permissionOverwrites.push({
          id: role.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak,
            PermissionsBitField.Flags.Stream,
          ],
        });
      }

      // Create private Help VC
      const helpChannel = await guild.channels.create({
        name: `🆘・Help | ${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: NEED_HELP_CATEGORY_ID,
        permissionOverwrites,
      });

      // Move user
      await member.voice.setChannel(helpChannel).catch(async () => {
        await helpChannel.delete().catch(() => {});
      });

      // =========================
      // SEND ALERT
      // =========================

      const alertChannel = await guild.channels
        .fetch(NEED_HELP_ALERT_CHANNEL_ID)
        .catch(() => null);

      if (alertChannel) {
        const alertEmbed = new EmbedBuilder()
          .setTitle("🚨 NEW HELP REQUEST")
          .setDescription("A member is requesting assistance.")
          .addFields(
            {
              name: "👤 User",
              value: `${member}\n\`${member.user.tag}\``,
              inline: true,
            },
            {
              name: "🎙️ Voice Channel",
              value: `${helpChannel}`,
              inline: true,
            },
            {
              name: "🟡 Status",
              value: "Waiting for a staff member...",
            }
          )
          .setThumbnail(member.displayAvatarURL({ dynamic: true }))
          .setFooter({
            text: `${guild.name} • Need Help System`,
          })
          .setTimestamp();

        const staffPing = NEED_HELP_STAFF_ROLES
          .map((roleId) => `<@&${roleId}>`)
          .join(" ");

        await alertChannel.send({
          content: staffPing,
          embeds: [alertEmbed],
          allowedMentions: {
            roles: NEED_HELP_STAFF_ROLES,
          },
        });
      }

      return;
    }

    // =========================
    // DELETE ANY EMPTY HELP VC
    // =========================

    const leftChannel = oldState.channel;

    if (
      leftChannel &&
      leftChannel.id !== NEED_HELP_VC_ID &&
      leftChannel.parentId === NEED_HELP_CATEGORY_ID &&
      leftChannel.name.startsWith("🆘・Help |")
    ) {
      // Wait a moment so Discord updates the member list
      setTimeout(async () => {
        try {
          const channel = await guild.channels
            .fetch(leftChannel.id)
            .catch(() => null);

          if (!channel) return;

          if (channel.members.size === 0) {
            await channel.delete().catch(() => {});
          }
        } catch (error) {
          console.error("❌ Help VC delete error:", error);
        }
      }, 500);
    }
  } catch (error) {
    console.error("❌ Need Help System Error:", error);
  }
});
// =========================
// MODERATION SYSTEM
// =========================

const PREFIX = "!";

// userId -> warnings[]
const warnings = new Map();

// =========================
// MODERATION EMBED
// =========================

function moderationEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

// =========================
// MODERATION DM
// =========================

async function sendModerationDM(member, title, description) {
  try {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    await member.send({ embeds: [embed] });
  } catch {
    // DMs disabled
  }
}

// =========================
// WARNINGS
// =========================

function getWarnings(userId) {
  return warnings.get(userId) || [];
}

function addWarning(userId, warning) {
  const current = getWarnings(userId);

  current.push(warning);

  warnings.set(userId, current);
}

function removeWarning(userId, index) {
  const current = getWarnings(userId);

  if (index < 0 || index >= current.length) {
    return false;
  }

  current.splice(index, 1);
  warnings.set(userId, current);

  return true;
}

// =========================
// GET MEMBER
// Mention OR ID
// =========================

async function getTargetMember(message, value) {
  if (!value) return null;

  const mentioned = message.mentions.members.first();

  if (mentioned) {
    return mentioned;
  }

  if (!/^\d{17,20}$/.test(value)) {
    return null;
  }

  return await message.guild.members.fetch(value).catch(() => null);
}

// =========================
// BAN
// !ban @user reason
// !ban ID reason
// =========================

client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content
    .slice(PREFIX.length)
    .trim()
    .split(/\s+/);

  const command = args.shift()?.toLowerCase();

  if (!command) return;

  // =========================
  // BAN
  // =========================

  if (command === "ban") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    if (target.id === message.author.id) {
      return message.reply("❌ You can't ban yourself.");
    }

    if (!target.bannable) {
      return message.reply("❌ I can't ban this member.");
    }

    const reason =
      args.slice(1).join(" ") || "No reason provided.";

    await sendModerationDM(
      target,
      "🔨 Member Banned",
      `You have been banned from **${message.guild.name}**.\n\n**Reason:** ${reason}\n**Moderator:** ${message.author.tag}`
    );

    await target.ban({ reason });

    const embed = moderationEmbed(
      "🔨 Member Banned",
      `> 👤 **User:** ${target.user.tag}\n> 🆔 **ID:** ${target.id}\n> 👮 **Moderator:** ${message.author.tag}\n> 📝 **Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "ban", embed);

    return message.reply(
      `🔨 **${target.user.tag}** has been banned.`
    );
  }

  // =========================
  // UNBAN
  // !unban ID reason
  // =========================

  if (command === "unban") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const userId = args[0];

    if (!userId || !/^\d{17,20}$/.test(userId)) {
      return message.reply(
        "❌ Please provide a valid user ID."
      );
    }

    const reason =
      args.slice(1).join(" ") || "No reason provided.";

    const bannedUser = await message.guild.bans
      .fetch(userId)
      .catch(() => null);

    if (!bannedUser) {
      return message.reply(
        "❌ This user is not banned or the ID is invalid."
      );
    }

    await message.guild.members.unban(userId, reason);

    const embed = moderationEmbed(
      "🔓 Member Unbanned",
      `> 👤 **User:** ${bannedUser.user.tag}\n> 🆔 **ID:** ${userId}\n> 👮 **Moderator:** ${message.author.tag}\n> 📝 **Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "ban", embed);

    return message.reply(
      `🔓 **${bannedUser.user.tag}** has been unbanned.`
    );
  }

  // =========================
  // KICK
  // !kick @user reason
  // !kick ID reason
  // =========================

  if (command === "kick") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.KickMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    if (target.id === message.author.id) {
      return message.reply("❌ You can't kick yourself.");
    }

    if (!target.kickable) {
      return message.reply("❌ I can't kick this member.");
    }

    const reason =
      args.slice(1).join(" ") || "No reason provided.";

    await sendModerationDM(
      target,
      "👢 Member Kicked",
      `You have been kicked from **${message.guild.name}**.\n\n**Reason:** ${reason}\n**Moderator:** ${message.author.tag}`
    );

    await target.kick(reason);

    const embed = moderationEmbed(
      "👢 Member Kicked",
      `> 👤 **User:** ${target.user.tag}\n> 🆔 **ID:** ${target.id}\n> 👮 **Moderator:** ${message.author.tag}\n> 📝 **Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "kick", embed);

    return message.reply(
      `👢 **${target.user.tag}** has been kicked.`
    );
  }

  // =========================
  // WARN
  // !warn @user reason
  // !warn ID reason
  // =========================

  if (command === "warn") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    if (target.user.bot) {
      return message.reply("❌ You can't warn a bot.");
    }

    const reason =
      args.slice(1).join(" ") || "No reason provided.";

    addWarning(target.id, {
      moderator: message.author.tag,
      moderatorId: message.author.id,
      reason,
      timestamp: Date.now(),
    });

    const count = getWarnings(target.id).length;

    await sendModerationDM(
      target,
      "⚠️ Warning Received",
      `You received a warning in **${message.guild.name}**.\n\n**Reason:** ${reason}\n**Moderator:** ${message.author.tag}\n**Total Warnings:** ${count}`
    );

    const embed = moderationEmbed(
      "⚠️ Member Warned",
      `> 👤 **User:** ${target.user.tag}\n> 🆔 **ID:** ${target.id}\n> 👮 **Moderator:** ${message.author.tag}\n> 📝 **Reason:** ${reason}\n> 📊 **Total Warnings:** ${count}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "warn", embed);

    return message.reply(
      `⚠️ **${target.user.tag}** has been warned.`
    );
  }

  // =========================
  // UNWARN
  // !unwarn @user 1
  // !unwarn ID 1
  // =========================

  if (command === "unwarn") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    const number = parseInt(args[1]);

    if (!number || number < 1) {
      return message.reply(
        "❌ Please provide a valid warning number."
      );
    }

    const removed = removeWarning(target.id, number - 1);

    if (!removed) {
      return message.reply(
        "❌ That warning does not exist."
      );
    }

    const remaining = getWarnings(target.id).length;

    const embed = moderationEmbed(
      "✅ Warning Removed",
      `> 👤 **User:** ${target.user.tag}\n> 🆔 **ID:** ${target.id}\n> 🔢 **Warning:** #${number}\n> 👮 **Moderator:** ${message.author.tag}\n> 📊 **Remaining:** ${remaining}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "warn", embed);

    return message.reply(
      `✅ Warning **#${number}** removed from **${target.user.tag}**.`
    );
  }

  // =========================
  // WARNINGS
  // !warnings @user
  // !warnings ID
  // =========================

  if (command === "warnings") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    const userWarnings = getWarnings(target.id);

    const embed = new EmbedBuilder()
      .setTitle("📋 Member Warnings")
      .setDescription(
        userWarnings.length
          ? userWarnings
              .map(
                (warning, index) =>
                  `**#${index + 1}** — ${warning.reason}\n👮 ${warning.moderator} • <t:${Math.floor(
                    warning.timestamp / 1000
                  )}:R>`
              )
              .join("\n\n")
          : "✅ This member has no warnings."
      )
      .addFields({
        name: "👤 User",
        value: `${target.user.tag}`,
      })
      .setTimestamp();

    return message.reply({
      embeds: [embed],
    });
  }

  // =========================
  // TIMEOUT
  // !timeout @user 10m reason
  // !timeout ID 10m reason
  // =========================

  if (command === "timeout") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    if (!target.moderatable) {
      return message.reply(
        "❌ I can't timeout this member."
      );
    }

    const durationText = args[1];

    if (!durationText) {
      return message.reply(
        "❌ Usage: `!timeout @user 10m reason`"
      );
    }

    const match = durationText.match(
      /^(\d+)(s|m|h|d)$/i
    );

    if (!match) {
      return message.reply(
        "❌ Duration must be `30s`, `10m`, `2h`, or `7d`."
      );
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const duration = amount * multipliers[unit];

    if (duration > 28 * 24 * 60 * 60 * 1000) {
      return message.reply(
        "❌ Maximum timeout duration is **28 days**."
      );
    }

    const reason =
      args.slice(2).join(" ") || "No reason provided.";

    await sendModerationDM(
      target,
      "⏱️ Member Timed Out",
      `You have been timed out in **${message.guild.name}**.\n\n**Duration:** ${durationText}\n**Reason:** ${reason}\n**Moderator:** ${message.author.tag}`
    );

    await target.timeout(duration, reason);

    const embed = moderationEmbed(
      "⏱️ Member Timed Out",
      `> 👤 **User:** ${target.user.tag}\n> 🆔 **ID:** ${target.id}\n> ⏱️ **Duration:** ${durationText}\n> 👮 **Moderator:** ${message.author.tag}\n> 📝 **Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "timeout", embed);

    return message.reply(
      `⏱️ **${target.user.tag}** has been timed out for **${durationText}**.`
    );
  }

  // =========================
  // UNTIMEOUT
  // !untimeout @user
  // !untimeout ID
  // =========================

  if (command === "untimeout") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    if (!target.moderatable) {
      return message.reply(
        "❌ I can't remove the timeout from this member."
      );
    }

    await target.timeout(
      null,
      `Timeout removed by ${message.author.tag}`
    );

    const embed = moderationEmbed(
      "🔊 Timeout Removed",
      `> 👤 **User:** ${target.user.tag}\n> 🆔 **ID:** ${target.id}\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "timeout", embed);

    return message.reply(
      `🔊 Timeout removed from **${target.user.tag}**.`
    );
  }

  // =========================
  // CLEAR
  // !clear 10
  // =========================

  if (command === "clear") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const amount = parseInt(args[0]);

    if (!amount || amount < 1 || amount > 100) {
      return message.reply(
        "❌ Choose a number between **1 and 100**."
      );
    }

    const deleted = await message.channel.bulkDelete(
      amount,
      true
    );

    const embed = moderationEmbed(
      "🧹 Messages Cleared",
      `> 💬 **Channel:** ${message.channel}\n> 🗑️ **Messages:** ${deleted.size}\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    const confirmation = await message.channel.send(
      `🧹 Deleted **${deleted.size}** messages.`
    );

    setTimeout(() => {
      confirmation.delete().catch(() => {});
    }, 3000);

    return;
  }

  // =========================
  // LOCK
  // !lock
  // =========================

  if (command === "lock") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: false,
      }
    );

    const embed = moderationEmbed(
      "🔒 Channel Locked",
      `> 💬 **Channel:** ${message.channel}\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    return message.reply(
      "🔒 This channel has been locked."
    );
  }

  // =========================
  // UNLOCK
  // !unlock
  // =========================

  if (command === "unlock") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: null,
      }
    );

    const embed = moderationEmbed(
      "🔓 Channel Unlocked",
      `> 💬 **Channel:** ${message.channel}\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    return message.reply(
      "🔓 This channel has been unlocked."
    );
  }

  // =========================
  // SLOWMODE
  // !slowmode 10
  // =========================

  if (command === "slowmode") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const seconds = parseInt(args[0]);

    if (
      isNaN(seconds) ||
      seconds < 0 ||
      seconds > 21600
    ) {
      return message.reply(
        "❌ Slowmode must be between **0 and 21600 seconds**."
      );
    }

    await message.channel.setRateLimitPerUser(seconds);

    const embed = moderationEmbed(
      "🐢 Slowmode Updated",
      `> 💬 **Channel:** ${message.channel}\n> 🐢 **Slowmode:** ${seconds} seconds\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    return message.reply(
      seconds === 0
        ? "🐢 Slowmode disabled."
        : `🐢 Slowmode set to **${seconds} seconds**.`
    );
  }

  // =========================
  // ROLE
  // !role @user @role
  // !role ID @role
  // =========================

  if (command === "role") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageRoles
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);
    const role = message.mentions.roles.first();

    if (!target || !role) {
      return message.reply(
        "❌ Usage: `!role @user @role`"
      );
    }

    if (role.managed) {
      return message.reply(
        "❌ I can't assign a managed role."
      );
    }

    if (
      role.position >=
      message.guild.members.me.roles.highest.position
    ) {
      return message.reply(
        "❌ That role is higher than my highest role."
      );
    }

    if (target.roles.cache.has(role.id)) {
      return message.reply(
        "❌ This member already has that role."
      );
    }

    await target.roles.add(role);

    const embed = moderationEmbed(
      "🎭 Role Added",
      `> 👤 **User:** ${target.user.tag}\n> 🎭 **Role:** ${role.name}\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "role", embed);

    return message.reply(
      `🎭 Added **${role.name}** to **${target.user.tag}**.`
    );
  }

  // =========================
  // UNROLE
  // !unrole @user @role
  // !unrole ID @role
  // =========================

  if (command === "unrole") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageRoles
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);
    const role = message.mentions.roles.first();

    if (!target || !role) {
      return message.reply(
        "❌ Usage: `!unrole @user @role`"
      );
    }

    if (role.managed) {
      return message.reply(
        "❌ I can't remove a managed role."
      );
    }

    if (
      role.position >=
      message.guild.members.me.roles.highest.position
    ) {
      return message.reply(
        "❌ That role is higher than my highest role."
      );
    }

    if (!target.roles.cache.has(role.id)) {
      return message.reply(
        "❌ This member doesn't have that role."
      );
    }

    await target.roles.remove(role);

    const embed = moderationEmbed(
      "🎭 Role Removed",
      `> 👤 **User:** ${target.user.tag}\n> 🎭 **Role:** ${role.name}\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "role", embed);

    return message.reply(
      `🎭 Removed **${role.name}** from **${target.user.tag}**.`
    );
  }

  // =========================
  // NICKNAME
  // !nickname @user New Name
  // !nickname ID New Name
  // =========================

  if (command === "nickname") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageNicknames
      )
    ) {
      return message.reply(
        "❌ You don't have permission to use this command."
      );
    }

    const target = await getTargetMember(message, args[0]);

    if (!target) {
      return message.reply(
        "❌ Please mention a valid member or provide a valid ID."
      );
    }

    if (!target.manageable) {
      return message.reply(
        "❌ I can't change this member's nickname."
      );
    }

    const newNickname = args.slice(1).join(" ");

    if (!newNickname) {
      return message.reply(
        "❌ Please provide a nickname."
      );
    }

    if (newNickname.length > 32) {
      return message.reply(
        "❌ Nickname can't be longer than 32 characters."
      );
    }

    const oldNickname =
      target.nickname || target.user.username;

    await target.setNickname(newNickname);

    const embed = moderationEmbed(
      "✏️ Nickname Changed",
      `> 👤 **User:** ${target.user.tag}\n> 📝 **Old:** ${oldNickname}\n> ✏️ **New:** ${newNickname}\n> 👮 **Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "memberUpdate", embed);

    return message.reply(
      `✏️ Nickname of **${target.user.tag}** changed to **${newNickname}**.`
    );
  }
});
// =========================
// VERIFICATION SYSTEM
// =========================

const VERIFY_CHANNEL_ID = "1536729461888786604";
const UNVERIFIED_ROLE_ID = "1536729539051393177";
const VERIFIED_ROLE_ID = "1535073145487233187";
const VERIFIED_FEMALE_ROLE_ID = "1535073253561737316";

// =========================
// AUTO UNVERIFIED
// =========================

client.on("guildMemberAdd", async (member) => {
  try {
    const role = await member.guild.roles.fetch(UNVERIFIED_ROLE_ID);

    if (!role) {
      console.error("❌ Unverified role not found.");
      return;
    }

    await member.roles.add(
      role,
      "New member - automatic verification"
    );

    console.log(`🔒 ${member.user.tag} received Unverified.`);
  } catch (error) {
    console.error("❌ Auto Unverified Error:", error);
  }
});
// =========================
// WELCOME SYSTEM
// =========================

const WELCOME_CHANNEL_ID = "1534392565346996327";

client.on("guildMemberAdd", async (member) => {
  try {
    const channel = await member.guild.channels.fetch(
      WELCOME_CHANNEL_ID
    );

    if (!channel || !channel.isTextBased()) {
      console.error("Welcome channel not found.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("WELCOME TO NIGHT SHIFT")
      .setDescription(
        `Welcome, **${member}**!\n` +
        "Glad to have you here. Enjoy your stay and have fun."
      )
      .setThumbnail(
        member.user.displayAvatarURL({
          dynamic: true,
          size: 256,
        })
      )
      .setFooter({
        text: `${member.guild.name} - Welcome System`,
      })
      .setTimestamp();

    await channel.send({
      content: `${member}`,
      embeds: [embed],
      allowedMentions: {
        users: [member.id],
      },
    });

    console.log(`Welcome sent for ${member.user.tag}`);
  } catch (error) {
    console.error("Welcome System Error:", error);
  }
});
// =========================
// VERIFICATION MESSAGE
// =========================

client.once("ready", async () => {
  try {
    const channel = await client.channels.fetch(VERIFY_CHANNEL_ID);

    if (!channel || !channel.isTextBased()) {
      console.error("❌ Verification channel not found.");
      return;
    }

    const messages = await channel.messages.fetch({
      limit: 50,
    });

    // Delete old verification messages
    const oldMessages = messages.filter(
      (message) =>
        message.author.id === client.user.id &&
        message.embeds.length > 0 &&
        message.embeds[0]?.title === "🔐 GET VERIFIED"
    );

    for (const message of oldMessages.values()) {
      await message.delete().catch(() => {});
    }

    // =========================
    // NEW VERIFICATION EMBED
    // =========================

    const embed = new EmbedBuilder()
      .setTitle("🔐 GET VERIFIED")
      .setDescription(
        "Welcome to **Night Shift 🪽**\n\n" +
        "We’re glad to have you here. Before exploring the server, " +
        "please complete the verification below.\n\n" +
        "Choose the option that best matches you. Once verified, " +
        "your **Unverified** role will be removed automatically " +
        "and you’ll gain access to the rest of the server."
      )
      .addFields({
        name: "🔐 Verification",
        value:
          "🔹 **Verified** — Standard member access\n" +
          "🌸 **Verified Female** — Female member access\n\n" +
          "> Please choose **only one** option. " +
          "You can change your choice later if needed.",
      })
      .setFooter({
        text: "Night Shift • Verification System",
      })
      .setTimestamp();

    // =========================
    // BUTTONS
    // =========================

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("verify_male")
        .setLabel("Verified")
        .setEmoji("🔹")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("verify_female")
        .setLabel("Verified Female")
        .setEmoji("🌸")
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({
      embeds: [embed],
      components: [row],
    });

    console.log("✅ Verification message ready.");
  } catch (error) {
    console.error("❌ Verification Message Error:", error);
  }
});

// =========================
// VERIFICATION BUTTONS
// =========================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (
    interaction.customId !== "verify_male" &&
    interaction.customId !== "verify_female"
  ) {
    return;
  }

  try {
    const member = await interaction.guild.members.fetch(
      interaction.user.id
    );

    const unverifiedRole =
      await interaction.guild.roles.fetch(UNVERIFIED_ROLE_ID);

    const verifiedRole =
      await interaction.guild.roles.fetch(VERIFIED_ROLE_ID);

    const femaleRole =
      await interaction.guild.roles.fetch(
        VERIFIED_FEMALE_ROLE_ID
      );

    if (!unverifiedRole || !verifiedRole || !femaleRole) {
      return interaction.reply({
        content: "❌ Verification roles are not configured correctly.",
        ephemeral: true,
      });
    }

    const selectedRole =
      interaction.customId === "verify_male"
        ? verifiedRole
        : femaleRole;

    const otherRole =
      interaction.customId === "verify_male"
        ? femaleRole
        : verifiedRole;

    // Remove opposite role
    if (member.roles.cache.has(otherRole.id)) {
      await member.roles.remove(
        otherRole,
        "Verification role changed"
      );
    }

    // Add selected role
    if (!member.roles.cache.has(selectedRole.id)) {
      await member.roles.add(
        selectedRole,
        "Member verified"
      );
    }

    // Remove Unverified
    if (member.roles.cache.has(unverifiedRole.id)) {
      await member.roles.remove(
        unverifiedRole,
        "Member verified"
      );
    }

    const roleName =
      interaction.customId === "verify_male"
        ? "🔹 Verified"
        : "🌸 Verified Female";

    await interaction.reply({
      content:
        `✅ You are now **${roleName}**!\n` +
        "Welcome to **Night Shift 🪽**.",
      ephemeral: true,
    });

    console.log(
      `✅ ${interaction.user.tag} verified as ${roleName}.`
    );
  } catch (error) {
    console.error("❌ Verification Error:", error);

    if (!interaction.replied) {
      await interaction.reply({
        content:
          "❌ Something went wrong. Please contact the staff.",
        ephemeral: true,
      });
    }
  }
});
// =========================
// AUTO REPLY SYSTEM
// =========================

const autoReplies = {
  "slm": "ghyrha",
  "cv": "bla bik ah hmdolah",
  "zbi": "lah yj3lo fkrk",
  "l9hba": "tfo 3lik trba chwiya",
  "chkon": "li 7waaaaaaaaaaaaaaaaaaaaaaaaak"
};

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase().trim();

  if (autoReplies[content]) {
    await message.reply(autoReplies[content]);
  }
});

// =========================
// LOGIN
// =========================

client.login(process.env.TOKEN).catch((error) => {
  console.error("LOGIN ERROR:", error.message);
});