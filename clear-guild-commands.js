require('dotenv').config();
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const commands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
    console.log(`🔍 ${commands.length} commande(s) locales détectée(s).`);

    for (const cmd of commands) {
      await rest.delete(`${Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)}/${cmd.id}`);
      console.log(`❌ Supprimée : ${cmd.name}`);
    }

    console.log('✅ Commandes locales (guild) nettoyées.');
  } catch (err) {
    console.error('❌ Erreur lors du nettoyage des commandes locales :', err);
  }
})();
