const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register a League of Legends account to track')
    .addStringOption(option =>
      option.setName('gamename')
        .setDescription('Game Name (without tag)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Tag Line (e.g., EUW, NA1)')
        .setRequired(true)),

  async execute(interaction, database, riotApi) {
    await interaction.deferReply();

    const gameName = interaction.options.getString('gamename');
    const tagLine = interaction.options.getString('tag');
    const guildId = interaction.guildId;

    try {
      const account = await riotApi.getAccountByRiotId(gameName, tagLine);
      const summoner = await riotApi.getSummonerByPuuid(account.puuid);

      const existingAccounts = database.getTrackedAccounts(guildId);
      if (existingAccounts.some(acc => acc.puuid === account.puuid)) {
        return await interaction.editReply({
          content: `❌ Account **${gameName}#${tagLine}** is already being tracked in this server.`,
          ephemeral: true
        });
      }

      const summonerName = summoner?.name || gameName;
      const discordUserId = interaction.user.id;

      database.addTrackedAccount(
        guildId,
        summonerName,
        gameName,
        tagLine,
        account.puuid,
        process.env.RIOT_REGION,
        summoner.id,
        discordUserId
      );

      await interaction.editReply({
        content: `✅ Compte **${gameName}#${tagLine}** enregistré et lié à <@${discordUserId}>!\n\n🎮 Les matchs seront trackés automatiquement.\n🎰 Tu peux maintenant utiliser \`/gamble\` sans spécifier ton compte!`
      });
    } catch (error) {
      console.error('Error registering account:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
