require('dotenv').config();
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const commands = await rest.get(Routes.applicationCommands(CLIENT_ID));
    console.log(`🧹 ${commands.length} commandes trouvées.`);

    for (const cmd of commands) {
      await rest.delete(`${Routes.applicationCommands(CLIENT_ID)}/${cmd.id}`);
      console.log(`❌ Supprimé : ${cmd.name}`);
    }

    console.log('✅ Toutes les commandes globales ont été supprimées.');
  } catch (err) {
    console.error('Erreur lors du nettoyage :', err);
  }
})();
