```javascript
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
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

const PREFIX = "!";

// =========================
// LOG CHANNELS
// =========================

const LOG_CATEGORY = "📚・LOGS";

const LOG_CHANNELS = {
  memberJoin: "👥・member-join",
  memberLeave: "🚪・member-leave",
  memberUpdate: "📝・member-update",
  messageDelete: "🗑️・message-delete",
  messageEdit: "✏️・message-edit",
  moderation: "🛡️・moderation",
  ban: "🔨・ban-logs",
  kick: "👢・kick-logs",
  timeout: "⏱️・timeout-logs",
  warn: "⚠️・warn-logs",
  role: "🎭・role-logs",
  channel: "📁・channel-logs",
};

// =========================
// WARNINGS
// =========================

const warnings = new Map();

function getWarnings(userId) {
  return warnings.get(userId) || [];
}

function addWarning(userId, data) {
  const list = getWarnings(userId);
  list.push(data);
  warnings.set(userId, list);
}

function removeWarning(userId, index) {
  const list = getWarnings(userId);

  if (index < 0 || index >= list.length) {
    return false;
  }

  list.splice(index, 1);
  warnings.set(userId, list);

  return true;
}

// =========================
// LOG SYSTEM
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

function getLogChannel(guild, type) {
  const name = LOG_CHANNELS[type];

  return guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildText && channel.name === name
  );
}

async function sendLog(guild, type, embed) {
  const channel = getLogChannel(guild, type);

  if (!channel) return;

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error("Log error:", error);
  }
}

// =========================
// READY
// =========================

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} is online!`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await setupLogs(guild);
      console.log(`📚 Logs ready: ${guild.name}`);
    } catch (error) {
      console.error(`❌ Log setup failed: ${guild.name}`, error);
    }
  }
});

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
      `**Nickname:** ${oldMember.nickname || "None"} -> ${
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
      `**Role Added:** ${addedRoles.map((role) => role.name).join(", ")}`
    );
  }

  if (removedRoles.size > 0) {
    changes.push(
      `**Role Removed:** ${removedRoles
        .map((role) => role.name)
        .join(", ")}`
    );
  }

  if (!changes.length) return;

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
    .setTitle("🗑️ Message Deleted")
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
// MODERATION EMBED
// =========================

function moderationEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

// =========================
// MODERATION COMMANDS
// =========================

client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
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
      return message.reply("❌ You don't have permission.");
    }

    const target =
      message.mentions.members.first() ||
      (args[0]
        ? await message.guild.members.fetch(args[0]).catch(() => null)
        : null);

    if (!target) {
      return message.reply("❌ Mention a valid member or provide their ID.");
    }

    if (target.id === message.author.id) {
      return message.reply("❌ You can't ban yourself.");
    }

    if (!target.bannable) {
      return message.reply("❌ I can't ban this member.");
    }

    const reason = args.slice(1).join(" ") || "No reason provided.";

    await sendModerationDM(
      target,
      "🔨 You have been banned",
      `**Server:** ${message.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${message.author.tag}`
    );

    await target.ban({ reason });

    const embed = moderationEmbed(
      "🔨 Member Banned",
      `**User:** ${target.user.tag}\n**ID:** ${target.id}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "ban", embed);

    return message.reply(`🔨 **${target.user.tag}** has been banned.`);
  }

  // =========================
  // UNBAN
  // =========================

  if (command === "unban") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.BanMembers
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const userId = args[0];

    if (!userId) {
      return message.reply("❌ Provide the user's ID.");
    }

    const bannedUser = await message.guild.bans
      .fetch(userId)
      .catch(() => null);

    if (!bannedUser) {
      return message.reply("❌ This user is not banned.");
    }

    const reason = args.slice(1).join(" ") || "No reason provided.";

    await message.guild.members.unban(userId, reason);

    const embed = moderationEmbed(
      "🔓 Member Unbanned",
      `**User:** ${bannedUser.user.tag}\n**ID:** ${userId}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "ban", embed);

    return message.reply(
      `🔓 **${bannedUser.user.tag}** has been unbanned.`
    );
  }

  // =========================
  // KICK
  // =========================

  if (command === "kick") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.KickMembers
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Mention a member.");
    }

    if (!target.kickable) {
      return message.reply("❌ I can't kick this member.");
    }

    const reason = args.slice(1).join(" ") || "No reason provided.";

    await sendModerationDM(
      target,
      "👢 You have been kicked",
      `**Server:** ${message.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${message.author.tag}`
    );

    await target.kick(reason);

    const embed = moderationEmbed(
      "👢 Member Kicked",
      `**User:** ${target.user.tag}\n**ID:** ${target.id}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "kick", embed);

    return message.reply(`👢 **${target.user.tag}** has been kicked.`);
  }

  // =========================
  // WARN
  // =========================

  if (command === "warn") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Mention a member.");
    }

    const reason = args.slice(1).join(" ") || "No reason provided.";

    addWarning(target.id, {
      moderator: message.author.tag,
      reason,
      timestamp: Date.now(),
    });

    const count = getWarnings(target.id).length;

    await sendModerationDM(
      target,
      "⚠️ You have received a warning",
      `**Server:** ${message.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${message.author.tag}\n**Warnings:** ${count}`
    );

    const embed = moderationEmbed(
      "⚠️ Member Warned",
      `**User:** ${target.user.tag}\n**ID:** ${target.id}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${count}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "warn", embed);

    return message.reply(`⚠️ **${target.user.tag}** has been warned.`);
  }

  // =========================
  // UNWARN
  // =========================

  if (command === "unwarn") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();
    const number = parseInt(args[1]);

    if (!target || !number) {
      return message.reply("❌ Usage: `!unwarn @user 1`");
    }

    if (!removeWarning(target.id, number - 1)) {
      return message.reply("❌ That warning doesn't exist.");
    }

    const embed = moderationEmbed(
      "✅ Warning Removed",
      `**User:** ${target.user.tag}\n**Warning:** #${number}\n**Moderator:** ${message.author.tag}\n**Remaining:** ${getWarnings(target.id).length}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "warn", embed);

    return message.reply(`✅ Warning #${number} removed.`);
  }

  // =========================
  // WARNINGS
  // =========================

  if (command === "warnings") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Mention a member.");
    }

    const list = getWarnings(target.id);

    const description = list.length
      ? list
          .map(
            (warning, index) =>
              `**#${index + 1}** ${warning.reason}\n👮 ${
                warning.moderator
              } • <t:${Math.floor(warning.timestamp / 1000)}:R>`
          )
          .join("\n\n")
      : "✅ No warnings.";

    const embed = new EmbedBuilder()
      .setTitle("📋 Member Warnings")
      .setDescription(description)
      .addFields({
        name: "User",
        value: `${target.user.tag}\n${target.id}`,
      })
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // =========================
  // TIMEOUT
  // =========================

  if (command === "timeout") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();
    const durationText = args[1];

    if (!target || !durationText) {
      return message.reply("❌ Usage: `!timeout @user 10m reason`");
    }

    if (!target.moderatable) {
      return message.reply("❌ I can't timeout this member.");
    }

    const match = durationText.match(/^(\d+)(s|m|h|d)$/i);

    if (!match) {
      return message.reply("❌ Use `30s`, `10m`, `2h`, or `7d`.");
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };

    const duration = amount * multipliers[unit];

    if (duration > 28 * 86400000) {
      return message.reply("❌ Maximum timeout is 28 days.");
    }

    const reason = args.slice(2).join(" ") || "No reason provided.";

    await target.timeout(duration, reason);

    const embed = moderationEmbed(
      "⏱️ Member Timed Out",
      `**User:** ${target.user.tag}\n**Duration:** ${durationText}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "timeout", embed);

    return message.reply(
      `⏱️ **${target.user.tag}** timed out for **${durationText}**.`
    );
  }

  // =========================
  // UNTIMEOUT
  // =========================

  if (command === "untimeout") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ModerateMembers
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Mention a member.");
    }

    await target.timeout(null);

    const embed = moderationEmbed(
      "🔊 Timeout Removed",
      `**User:** ${target.user.tag}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "timeout", embed);

    return message.reply(`🔊 Timeout removed from **${target.user.tag}**.`);
  }

  // =========================
  // CLEAR
  // =========================

  if (command === "clear") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const amount = parseInt(args[0]);

    if (!amount || amount < 1 || amount > 100) {
      return message.reply("❌ Choose a number from 1 to 100.");
    }

    const deleted = await message.channel.bulkDelete(amount, true);

    const embed = moderationEmbed(
      "🧹 Messages Cleared",
      `**Channel:** ${message.channel}\n**Messages:** ${deleted.size}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    return;
  }

  // =========================
  // LOCK
  // =========================

  if (command === "lock") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: false,
      }
    );

    const embed = moderationEmbed(
      "🔒 Channel Locked",
      `**Channel:** ${message.channel}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    return message.reply("🔒 Channel locked.");
  }

  // =========================
  // UNLOCK
  // =========================

  if (command === "unlock") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      {
        SendMessages: null,
      }
    );

    const embed = moderationEmbed(
      "🔓 Channel Unlocked",
      `**Channel:** ${message.channel}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    return message.reply("🔓 Channel unlocked.");
  }

  // =========================
  // SLOWMODE
  // =========================

  if (command === "slowmode") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageChannels
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const seconds = parseInt(args[0]);

    if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
      return message.reply("❌ Use a number from 0 to 21600.");
    }

    await message.channel.setRateLimitPerUser(seconds);

    const embed = moderationEmbed(
      "🐢 Slowmode Updated",
      `**Channel:** ${message.channel}\n**Seconds:** ${seconds}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);

    return message.reply(
      seconds === 0
        ? "🐢 Slowmode disabled."
        : `🐢 Slowmode set to ${seconds} seconds.`
    );
  }

  // =========================
  // ROLE
  // =========================

  if (command === "role") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageRoles
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();
    const role = message.mentions.roles.first();

    if (!target || !role) {
      return message.reply("❌ Usage: `!role @user @role`");
    }

    if (role.managed) {
      return message.reply("❌ This role is managed.");
    }

    if (role.position >= message.guild.members.me.roles.highest.position) {
      return message.reply("❌ This role is higher than my role.");
    }

    await target.roles.add(role);

    const embed = moderationEmbed(
      "🎭 Role Added",
      `**User:** ${target.user.tag}\n**Role:** ${role.name}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "role", embed);

    return message.reply(`🎭 Added **${role.name}**.`);
  }

  // =========================
  // UNROLE
  // =========================

  if (command === "unrole") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageRoles
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();
    const role = message.mentions.roles.first();

    if (!target || !role) {
      return message.reply("❌ Usage: `!unrole @user @role`");
    }

    if (role.managed) {
      return message.reply("❌ This role is managed.");
    }

    await target.roles.remove(role);

    const embed = moderationEmbed(
      "🎭 Role Removed",
      `**User:** ${target.user.tag}\n**Role:** ${role.name}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "role", embed);

    return message.reply(`🎭 Removed **${role.name}**.`);
  }

  // =========================
  // NICKNAME
  // =========================

  if (command === "nickname") {
    if (
      !message.member.permissions.has(
        PermissionsBitField.Flags.ManageNicknames
      )
    ) {
      return message.reply("❌ You don't have permission.");
    }

    const target = message.mentions.members.first();

    if (!target) {
      return message.reply("❌ Mention a member.");
    }

    const nickname = args.slice(1).join(" ");

    if (!nickname) {
      return message.reply("❌ Provide a nickname.");
    }

    if (nickname.length > 32) {
      return message.reply("❌ Nickname is too long.");
    }

    const oldNickname = target.nickname || target.user.username;

    await target.setNickname(nickname);

    const embed = moderationEmbed(
      "✏️ Nickname Changed",
      `**User:** ${target.user.tag}\n**Old:** ${oldNickname}\n**New:** ${nickname}\n**Moderator:** ${message.author.tag}`
    );

    await sendLog(message.guild, "moderation", embed);
    await sendLog(message.guild, "memberUpdate", embed);

    return message.reply(`✏️ Nickname changed to **${nickname}**.`);
  }
});

// =========================
// LOGIN
// =========================

if (!process.env.TOKEN) {
  console.error("❌ TOKEN is missing from .env");
  process.exit(1);
}

client.login(process.env.TOKEN).catch((error) => {
  console.error("❌ Login failed:", error);
});
```
