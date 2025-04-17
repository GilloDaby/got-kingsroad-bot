
require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const config = require('./config.json');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const REMINDER_FILE = './reminders.json';

function loadReminders() {
  try {
    const data = fs.readFileSync(REMINDER_FILE);
    const reminders = JSON.parse(data);
    return Array.isArray(reminders) ? reminders : [];
  } catch {
    return [];
  }
}

function saveReminders(reminders) {
  fs.writeFileSync(REMINDER_FILE, JSON.stringify(reminders, null, 2));
}
let timerMessageId = config.timerMessageId || null;
let timerChannelId = config.channelId || null;
let lastDrogonHour = null;
let lastDailyDate = null;

function saveConfig() {
  fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}
function getWeeklyResetTime() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(5, 0, 0, 0); // 05:00 UTC = 01:00 Québec

  const day = now.getUTCDay();
  const passed = day > 4 || (day === 4 && now.getUTCHours() >= 5);
  next.setUTCDate(now.getUTCDate() + (passed ? 7 - day + 4 : 4 - day));
  return next;
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
  if (!config.channelId || !config.timerMessageId) return;
  try {
    const channel = await client.channels.fetch(config.channelId);
    const message = await channel.messages.fetch(config.timerMessageId);

    const now = new Date();
    const nextDrogon = getNextDrogonTime();
    const nextReset = getDailyResetTime();
    const nextWeekly = getWeeklyResetTime();

    const drogonDiff = nextDrogon - now;
    const dailyDiff = nextReset - now;
    const weeklyDiff = nextWeekly - now;

const content = `⏰ **Daily Reset** in: ${formatCountdown(dailyDiff)}\n` +
                `🔥 **Drogon Timer**: ${formatCountdown(drogonDiff, true)}\n` +
                `📅 **Weekly Reset**: ${formatCountdown(weeklyDiff)}`;
    
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

  setInterval(async () => {
  const reminders = loadReminders();
  const now = new Date();

  const timers = {
    drogon: getNextDrogonTime(),
    daily: getDailyResetTime(),
    weekly: getWeeklyResetTime()
  };

  const updated = [];

  for (const reminder of reminders) {
    const eventTime = timers[reminder.timer];
    const diff = eventTime - now;
    const threshold = reminder.minutes * 60 * 1000;

    if (diff > threshold) {
      updated.push(reminder); // pas encore le moment
    } else {
      // envoyer le DM
      try {
        const user = await client.users.fetch(reminder.userId);
        await user.send(`🔔 **Reminder:** ${reminder.timer.toUpperCase()} starts in ${reminder.minutes} minute(s)!`);
        console.log(`✅ Reminder sent to ${user.tag}`);
      } catch (e) {
        console.warn(`❌ Failed to DM ${reminder.userId}:`, e.message);
      }
      // ne pas remettre dans updated = supprime le rappel
    }
  }

  saveReminders(updated);
}, 30 * 1000); // toutes les 30 secondes
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  let sub = null;
  try {
    sub = interaction.options.getSubcommand();
  } catch {
    const replyMessage = `❌ Please use a valid subcommand:\n- /setup channel\n- /setup message\n- /setup reset\n- /setup rankdaily\n- /setup rankdrogon\n- /setup ping\n- /setup help`;
    await interaction.reply({
      embeds: [{ title: 'Error', description: replyMessage, color: 0xe74c3c }],
      flags: 64
    });
    return;
  }

  if (interaction.commandName === 'setup') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({
        embeds: [{
          title: '⛔ Access Denied',
          description: 'Only administrators can use the `/setup` command.',
          color: 0xe74c3c
        }],
        flags: 64
      });
    }

    let replyMessage = '';

    if (sub === 'channel') {
  config.channelId = interaction.channel.id;
  saveConfig();
      replyMessage = `✅ Channel set to: <#${config.channelId}>`;

  await interaction.reply({
    embeds: [{
      title: '✅ Setup',
      description: replyMessage,
      color: 0x2ecc71
    }],
    flags: 64
  });

  setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
}


    if (sub === 'message') {
      await interaction.deferReply({ flags: 64 });
      if (!config.channelId) {
        replyMessage = "❌ No channel configured. Use `/setup channel` first.";
      } else {
        try {
          const channel = await client.channels.fetch(config.channelId);
          const drogonDiff = getNextDrogonTime() - new Date();
          const dailyDiff = getDailyResetTime() - new Date();
          const weeklyDiff = getWeeklyResetTime() - new Date();
const msg = await channel.send(
  `⏰ **Daily Reset** in: ${formatCountdown(dailyDiff)}\n` +
  `🔥 **Drogon Timer**: ${formatCountdown(drogonDiff, true)}\n` +
  `📅 **Weekly Reset**: ${formatCountdown(weeklyDiff)}`
);
          config.timerMessageId = msg.id;
          timerMessageId = msg.id;

          saveConfig();
          timerMessageId = msg.id;
          replyMessage = `🆗 Timer message sent in <#${config.channelId}>`;
        } catch (err) {
          console.error("Error sending message:", err.message);
          replyMessage = "❌ Failed to send timer message.";
        }
      }
      await interaction.editReply({
        embeds: [{ title: '✅ Setup', description: replyMessage, color: 0x2ecc71 }]
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    }

    if (sub === 'reset') {
      if (!config.channelId || !config.timerMessageId) {
        replyMessage = "⚠️ No active timer message to delete.";
      } else {
        try {
          const channel = await client.channels.fetch(config.channelId);
          const msg = await channel.messages.fetch(config.timerMessageId);
          await msg.delete();
          config.timerMessageId = null;
          saveConfig();
          replyMessage = "🧹 Timer message successfully deleted.";
        } catch (err) {
          console.error("Error deleting message:", err.message);
          replyMessage = "❌ Failed to delete the timer message.";
        }
      }
      await interaction.reply({
        embeds: [{ title: '✅ Setup', description: replyMessage, color: 0x2ecc71 }],
        flags: 64
      });
    }

    if (sub === 'rankdaily') {
      const role = interaction.options.getRole('role');
      config.dailyRoleId = role.id;
      saveConfig();
      replyMessage = `📌 Daily Reset role set to: <@&${role.id}>`;
      await interaction.reply({
        embeds: [{ title: '✅ Setup', description: replyMessage, color: 0x2ecc71 }],
        flags: 64
      });
    }

    if (sub === 'rankdrogon') {
      const role = interaction.options.getRole('role');
      config.drogonRoleId = role.id;
      saveConfig();
      replyMessage = `📌 Drogon Timer role set to: <@&${role.id}>`;
      await interaction.reply({
        embeds: [{ title: '✅ Setup', description: replyMessage, color: 0x2ecc71 }],
        flags: 64
      });
    }
    
    if (sub === 'rankweekly') {
  const role = interaction.options.getRole('role');
  config.weeklyRoleId = role.id;
  saveConfig();
  replyMessage = `📌 Weekly Reset role set to: <@&${role.id}>`;
  await interaction.reply({
    embeds: [{ title: '✅ Setup', description: replyMessage, color: 0x2ecc71 }],
    flags: 64
  });
}

    
if (sub === 'reminder') {
  const action = interaction.options.getSubcommand();

  if (action === 'add') {
    const timerType = interaction.options.getString('timer');
    const minutes = interaction.options.getInteger('minutes');
    const user = interaction.user;

    let targetTime;
    if (timerType === 'drogon') targetTime = getNextDrogonTime();
    else if (timerType === 'daily') targetTime = getDailyResetTime();
    else if (timerType === 'weekly') targetTime = getWeeklyResetTime();
    else {
      return interaction.reply({ content: "❌ Unknown timer type.", ephemeral: true });
    }

    const now = new Date();
    const diffToEvent = Math.floor((targetTime - now) / 60000);
    const delay = targetTime - now - (minutes * 60000);

    if (delay <= 0) {
      return interaction.reply({
        content: `❌ ${timerType.toUpperCase()} happens in **${diffToEvent} minute(s)**. It's too late to set a **${minutes}-minute reminder**.`,
        ephemeral: true
      });
    }

    const reminders = loadReminders();
    reminders.push({
      userId: user.id,
      timer: timerType,
      minutes: minutes
    });
    saveReminders(reminders);

    return interaction.reply({
      content: `✅ I’ll DM you **${minutes} minute(s)** before **${timerType.toUpperCase()}**.`,
      ephemeral: true
    });
  }

  if (action === 'list') {
    const allReminders = loadReminders();
    const userReminders = allReminders.filter(r => r.userId === interaction.user.id);

    if (userReminders.length === 0) {
      return interaction.reply({
        content: "📭 You have no active reminders.",
        ephemeral: true
      });
    }

    const description = userReminders
      .map(r => `• **${r.timer.toUpperCase()}** – ${r.minutes} minute(s) before`)
      .join('\n');

    return interaction.reply({
      embeds: [{
        title: '⏰ Your Active Reminders',
        description,
        color: 0x00bfff
      }],
      ephemeral: true
    });
  }

  if (action === 'clear') {
    let reminders = loadReminders();
    const before = reminders.length;
    reminders = reminders.filter(r => r.userId !== interaction.user.id);
    const removed = before - reminders.length;
    saveReminders(reminders);

    return interaction.reply({
      embeds: [{
        title: '🗑️ Reminders cleared',
        description: `You removed **${removed}** reminder(s).`,
        color: 0xe74c3c
      }],
      ephemeral: true
    });
  }
}
    
    if (sub === 'help') {
      replyMessage = `
📘 **Available Commands**:
• \`/setup channel\` – Sets the channel to post the timer
• \`/setup message\` – Sends or resets the timer message
• \`/setup reset\` – Deletes the active timer message
• \`/setup rankdaily @role\` – Sets the role to ping before Daily Reset
• \`/setup rankdrogon @role\` – Sets the role to ping before Drogon
• \`/setup rankweekly @role\` – Sets the role to ping before Weekly Reset
• \`/setup reminder timer:<type> minutes:<X>\` – Send yourself a DM reminder before a timer ends
• \`/setup ping\` – Shows bot latency
• \`/setup help\` – Shows this help message`;
      await interaction.reply({
        embeds: [{ title: '📘 Help', description: replyMessage, color: 0x3498db }],
        flags: 64
      });
      setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
    }

    if (sub === 'ping') {
      const latency = Date.now() - interaction.createdTimestamp;
      await interaction.reply({
        embeds: [{
          title: '🏓 Pong!',
          description: `Latency: ${latency}ms`,
          color: 0x00bfff
        }],
        flags: 64
      });
    }
  }
});

(async () => {
  const commands = [
    new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Timer setup and configuration')
      .addSubcommand(sub => 
        sub.setName('channel')
          .setDescription('Set the channel for displaying the timer')
      )
      .addSubcommand(sub => 
        sub.setName('message')
          .setDescription('Send or reset the timer message')
      )
      .addSubcommand(sub => 
        sub.setName('reset')
          .setDescription('Delete the current timer message')
      )
      .addSubcommand(sub => 
        sub.setName('rankdaily')
          .setDescription('Set the role to ping before the Daily Reset')
          .addRoleOption(option => 
            option.setName('role').setDescription('Role to ping').setRequired(true)
          )
      )
      .addSubcommand(sub => 
        sub.setName('rankdrogon')
          .setDescription('Set the role to ping before Drogon spawns')
          .addRoleOption(option => 
            option.setName('role').setDescription('Role to ping').setRequired(true)
          )
      )

     .addSubcommand(sub =>
  sub.setName('rankweekly')
    .setDescription('Set the role to ping before the Weekly Reset')
    .addRoleOption(option =>
      option.setName('role').setDescription('Role to ping').setRequired(true)
    )
) 
    
.addSubcommandGroup(group =>
  group.setName('reminder')
    .setDescription('Manage private reminders')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a reminder before a timer')
        .addStringOption(opt =>
          opt.setName('timer')
            .setDescription('Choose the timer')
            .setRequired(true)
            .addChoices(
              { name: 'Drogon', value: 'drogon' },
              { name: 'Daily Reset', value: 'daily' },
              { name: 'Weekly Reset', value: 'weekly' }
            )
        )
        .addIntegerOption(opt =>
          opt.setName('minutes')
            .setDescription('How many minutes before')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List your active reminders')
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all your active reminders')
    )
)

    
    .addSubcommand(sub =>
        sub.setName('help')
          .setDescription('Display command usage help')
      )
    .addSubcommand(sub =>
        sub.setName('ping')
          .setDescription('Check bot latency')
      )
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
