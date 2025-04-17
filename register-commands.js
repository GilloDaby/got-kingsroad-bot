require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID; // Ajoute cette variable dans ton .env

const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configuration des timers')
    .addSubcommand(sub => sub.setName('channel').setDescription('Définit le salon pour afficher les timers'))
    .addSubcommand(sub => sub.setName('message').setDescription('Envoie ou remet à zéro le message du timer'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Supprime le message de timer actif'))
    .addSubcommand(sub => sub.setName('rankdaily').setDescription('Définit le rôle pour Daily Reset').addRoleOption(option => option.setName('role').setDescription('Le rôle à mentionner').setRequired(true)))
    .addSubcommand(sub => sub.setName('rankdrogon').setDescription('Définit le rôle pour Drogon Timer').addRoleOption(option => option.setName('role').setDescription('Le rôle à mentionner').setRequired(true)))
    .addSubcommand(sub => sub.setName('help').setDescription("Affiche les informations d'aide sur les commandes disponibles"))
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🔁 Enregistrement des commandes slash en local (GUILD)...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ Commandes enregistrées dans le serveur avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors de l’enregistrement :', error);
  }
})();
