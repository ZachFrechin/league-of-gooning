const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unregister')
    .setDescription('Unregister a League of Legends account')
    .addStringOption(option =>
      option.setName('gamename')
        .setDescription('Game Name (without tag)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('tag')
        .setDescription('Tag Line')
        .setRequired(true)),

  async execute(interaction, database) {
    await interaction.deferReply();

    const gameName = interaction.options.getString('gamename');
    const tagLine = interaction.options.getString('tag');
    const guildId = interaction.guildId;

    try {
      const result = database.removeTrackedAccount(guildId, gameName, tagLine);

      if (result.changes === 0) {
        return await interaction.editReply({
          content: `❌ Account **${gameName}#${tagLine}** is not being tracked in this server.`,
          ephemeral: true
        });
      }

      await interaction.editReply({
        content: `✅ Successfully unregistered **${gameName}#${tagLine}**!`
      });
    } catch (error) {
      console.error('Error unregistering account:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
