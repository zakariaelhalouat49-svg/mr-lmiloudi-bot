const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ===============================
// IDS
// ===============================

const VERIFICATION_CHANNEL_ID = '1536147998713847961';

const UNVERIFIED_ROLE_ID = '1536145218427166720';

const VERIFIED_MALE_ROLE_ID = '1535073145487233187';

const VERIFIED_FEMALE_ROLE_ID = '1535073253561737316';


// ===============================
// BOT READY
// ===============================

client.once('ready', async () => {

    console.log(`✅ ${client.user.tag} is online!`);

    try {

        const channel = await client.channels.fetch(
            VERIFICATION_CHANNEL_ID
        );

        if (!channel) {
            console.log('❌ Verification channel not found.');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔐 Verification Required')
            .setDescription(
                'Welcome to **Night Shift**!\n\n' +
                'To access the server, please verify yourself:\n\n' +
                '👨 **Verify Male**\n' +
                '👩 **Verify Female**\n\n' +
                'Click the button that corresponds to you.\n\n' +
                '✅ Your **Unverified** role will be removed automatically.'
            )
            .setFooter({
                text: 'Night Shift • Verification System'
            });

        const buttons = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId('verify_male')
                    .setLabel('Verify Male')
                    .setEmoji('👨')
                    .setStyle(ButtonStyle.Primary),

                new ButtonBuilder()
                    .setCustomId('verify_female')
                    .setLabel('Verify Female')
                    .setEmoji('👩')
                    .setStyle(ButtonStyle.Danger)

            );

        await channel.send({
            embeds: [embed],
            components: [buttons]
        });

        console.log('✅ Verification message sent.');

    } catch (error) {

        console.error(
            '❌ Could not send verification message:',
            error
        );

    }

});


// ===============================
// NEW MEMBER
// ===============================

client.on('guildMemberAdd', async member => {

    try {

        const role = member.guild.roles.cache.get(
            UNVERIFIED_ROLE_ID
        );

        if (!role) {
            console.log('❌ Unverified role not found.');
            return;
        }

        await member.roles.add(role);

        console.log(
            `🔒 ${member.user.tag} → Unverified`
        );

    } catch (error) {

        console.error(
            '❌ Auto role error:',
            error
        );

    }

});


// ===============================
// VERIFICATION BUTTONS
// ===============================

client.on('interactionCreate', async interaction => {

    if (!interaction.isButton()) return;

    if (
        interaction.customId !== 'verify_male' &&
        interaction.customId !== 'verify_female'
    ) {
        return;
    }

    try {

        const member = interaction.member;

        const unverifiedRole =
            interaction.guild.roles.cache.get(
                UNVERIFIED_ROLE_ID
            );

        const maleRole =
            interaction.guild.roles.cache.get(
                VERIFIED_MALE_ROLE_ID
            );

        const femaleRole =
            interaction.guild.roles.cache.get(
                VERIFIED_FEMALE_ROLE_ID
            );

        if (
            !unverifiedRole ||
            !maleRole ||
            !femaleRole
        ) {

            return interaction.reply({
                content: '❌ Verification roles not found.',
                ephemeral: true
            });

        }

        if (
            interaction.customId === 'verify_male'
        ) {

            if (
                member.roles.cache.has(
                    VERIFIED_FEMALE_ROLE_ID
                )
            ) {

                await member.roles.remove(
                    femaleRole
                );

            }

            await member.roles.remove(
                unverifiedRole
            );

            await member.roles.add(
                maleRole
            );

            await interaction.reply({
                content:
                    '✅ You are now verified as **Male**!',
                ephemeral: true
            });

        }


        if (
            interaction.customId === 'verify_female'
        ) {

            if (
                member.roles.cache.has(
                    VERIFIED_MALE_ROLE_ID
                )
            ) {

                await member.roles.remove(
                    maleRole
                );

            }

            await member.roles.remove(
                unverifiedRole
            );

            await member.roles.add(
                femaleRole
            );

            await interaction.reply({
                content:
                    '✅ You are now verified as **Female**!',
                ephemeral: true
            });

        }

    } catch (error) {

        console.error(
            '❌ Verification error:',
            error
        );

        if (!interaction.replied) {

            await interaction.reply({
                content:
                    '❌ Verification failed.',
                ephemeral: true
            });

        }

    }

});


// ===============================
// LOGIN
// ===============================

client.login(process.env.TOKEN);