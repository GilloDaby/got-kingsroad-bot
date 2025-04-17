require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const config = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let timerMessageId = null;
let timerChannelId = null;
let lastDrogonHour = null;
let lastDailyDate = null;

function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

function getDailyResetTime() {
  const now = new Date();
  const nextReset = new Date();
  nextReset.setUTCHours(7, 0, 0, 0);
  if (now >= nextReset) nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  return nextReset;
}

function getNextDrogonTime() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(now.getUTCHours() + 1);
  if (next.getUTCHours() === 1) next.setUTCHours(2);
  return next;
}

function formatCountdown(ms, short = false) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return short ? `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${h}h ${m}m ${s}s`;
}

async function updateTimerMessage(client) {
  if (!config.channelId || !timerMessageId) return;
  try {
    const channel = await client.channels.fetch(config.channelId);
    const message = await channel.messages.fetch(timerMessageId);

    const now = new Date();
    const nextDrogon = getNextDrogonTime();
    const nextReset = getDailyResetTime();

    const drogonDiff = nextDrogon - now;
    const dailyDiff = nextReset - now;

    const content = `⏰ **Daily Reset** in: ${formatCountdown(dailyDiff)}\n🔥 **Drogon Timer**: ${formatCountdown(drogonDiff, true)}`;
    await message.edit({ content });

    const currentHour = now.getUTCHours();
    if (drogonDiff <= 5 * 60 * 1000 && currentHour !== 1 && lastDrogonHour !== currentHour) {
      if (config.drogonRoleId) await channel.send(`<@&${config.drogonRoleId}> 🔥 **Drogon spawns at ${nextDrogon.getUTCHours()}:00 UTC!**`);
      lastDrogonHour = currentHour;
    }

    const today = nextReset.toDateString();
    if (dailyDiff <= 5 * 60 * 1000 && lastDailyDate !== today) {
      if (config.dailyRoleId) await channel.send(`<@&${config.dailyRoleId}> ⏰ **Daily Reset incoming (07:00 UTC)**`);
      lastDailyDate = today;
    }
  } catch (err) {
    console.error("Timer update error:", err.message);
  }
}

client.once('ready', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  setInterval(() => updateTimerMessage(client), 10000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  let sub = null;
  try {
    sub = interaction.options.getSubcommand();
  } catch {
    const replyMessage = `
❌ Please use a valid subcommand:

- /setup channel
- /setup message
- /setup reset
- /setup rankdaily
- /setup rankdrogon
- /setup help`;
    await interaction.reply({
      embeds: [{ title: 'Error', description: replyMessage, color: 0xe74c3c }],
      ephemeral: true
    });
    return;
  }

  if (interaction.commandName === 'setup') {
    // 🔒 Only allow administrators
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({
        embeds: [{
          title: '⛔ Access Denied',
          description: 'Only server administrators can use the `/setup` command.',
          color: 0xe74c3c
        }],
        ephemeral: true
      });
    }

    let replyMessage = '';

    if (sub === 'channel') {
      config.channelId = interaction.channel.id;
      saveConfig();
      replyMessage = `✅ Channel set to: <#${config.channelId}>`;
    }

    if (sub === 'message') {
      if (!config.channelId) {
        replyMessage = "❌ No channel configured. Use `/setup channel` first.";
      } else {
        const channel = await client.channels.fetch(config.channelId);
        const drogonDiff = getNextDrogonTime() - new Date();
        const dailyDiff = getDailyResetTime() - new Date();
        const msg = await channel.send(`⏰ **Daily Reset** in: ${formatCountdown(dailyDiff)}\n🔥 **Drogon Timer**: ${formatCountdown(drogonDiff, true)}`);
        timerMessageId = msg.id;
        timerChannelId = config.channelId;
        replyMessage = `🆗 Timer message sent in <#${config.channelId}>`;
      }
    }

    if (sub === 'reset') {
      if (!config.channelId || !timerMessageId) {
        replyMessage = "⚠️ No active message to delete.";
      } else {
        try {
          const channel = await client.channels.fetch(config.channelId);
          const msg = await channel.messages.fetch(timerMessageId);
          await msg.delete();
          timerMessageId = null;
          replyMessage = "🧹 Timer message successfully deleted.";
        } catch (err) {
          console.error("Error deleting message:", err.message);
          replyMessage = "❌ Failed to delete the message.";
        }
      }
    }

    if (sub === 'rankdaily') {
      const role = interaction.options.getRole('role');
      config.dailyRoleId = role.id;
      saveConfig();
      replyMessage = `📌 Daily Reset role set to: <@&${role.id}>`;
    }

    if (sub === 'rankdrogon') {
      const role = interaction.options.getRole('role');
      config.drogonRoleId = role.id;
      saveConfig();
      replyMessage = `📌 Drogon Timer role set to: <@&${role.id}>`;
    }

    if (sub === 'help') {
      replyMessage = `
📘 **Available Commands**:

• \`/setup channel\` – Sets the channel to post the timer
• \`/setup message\` – Sends or resets the timer message
• \`/setup reset\` – Deletes the active timer message
• \`/setup rankdaily @role\` – Defines the role to ping before Daily Reset
• \`/setup rankdrogon @role\` – Defines the role to ping before Drogon spawn
• \`/setup help\` – Shows this help message`;
    }

    if (replyMessage) {
      await interaction.reply({
        embeds: [{
          title: sub === 'help' ? '📘 Help' : '✅ Success',
          description: replyMessage,
          color: sub === 'help' ? 0x3498db : 0x2ecc71
        }],
        ephemeral: true
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), sub === 'help' ? 10000 : 5000);
    }
  }
});

(async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Timer setup and configuration')
      .addSubcommand(sub => sub.setName('channel').setDescription('Set the channel for displaying the timer'))
      .addSubcommand(sub => sub.setName('message').setDescription('Send or reset the timer message'))
      .addSubcommand(sub => sub.setName('reset').setDescription('Delete the current timer message'))
      .addSubcommand(sub => sub.setName('rankdaily').setDescription('Set the role to ping before the Daily Reset').addRoleOption(option => option.setName('role').setDescription('Role to ping').setRequired(true)))
      .addSubcommand(sub => sub.setName('rankdrogon').setDescription('Set the role to ping before Drogon spawns').addRoleOption(option => option.setName('role').setDescription('Role to ping').setRequired(true)))
      .addSubcommand(sub => sub.setName('help').setDescription("Display command usage help"))
  ];

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('🌍 /setup commands registered globally');
  } catch (err) {
    console.error("Command registration error:", err.message);
  }
})();

client.login(TOKEN);
