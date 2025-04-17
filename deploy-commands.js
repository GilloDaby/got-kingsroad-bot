require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
console.log("TOKEN =", process.env.DISCORD_TOKEN);

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName('timer')
    .setDescription('Affiche le Drogon Timer et le Daily Reset')
    .toJSON()
];

// 📌 Lancer avec "node deploy-commands.js guild" pour Guild uniquement
// 📌 Lancer avec "node deploy-commands.js global" pour Global

(async () => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const mode = process.argv[2];

  try {
    if (mode === 'guild') {
      await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log('✅ Commandes enregistrées sur le serveur (Guild)');
    } else if (mode === 'global') {
      await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log('🌐 Commandes globales enregistrées (visible dans ~1h)');
    } else {
      console.log('❗️Usage : node deploy-commands.js guild | global');
    }
  } catch (error) {
    console.error('Erreur lors du déploiement :', error);
  }
})();
