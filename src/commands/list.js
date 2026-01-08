const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all tracked League of Legends accounts in this server'),

  async execute(interaction, database) {
    await interaction.deferReply();

    const guildId = interaction.guildId;

    try {
      const accounts = database.getTrackedAccounts(guildId);

      if (accounts.length === 0) {
        return await interaction.editReply({
          content: '📋 No accounts are currently being tracked in this server.\n\nUse `/register` to add an account!',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Tracked League of Legends Accounts')
        .setDescription(`Currently tracking **${accounts.length}** account${accounts.length !== 1 ? 's' : ''}`)
        .setTimestamp();

      const accountList = accounts.map((acc, index) => {
        return `${index + 1}. **${acc.game_name}#${acc.tag_line}**\n   Summoner: ${acc.summoner_name} (${acc.region.toUpperCase()})`;
      }).join('\n\n');

      embed.addFields({ name: 'Accounts', value: accountList });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error listing accounts:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
