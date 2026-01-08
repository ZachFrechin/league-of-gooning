const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EloCalculator = require('../utils/eloCalculator');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Display the server ELO leaderboard')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of players to show (default: 10)')
        .setMinValue(5)
        .setMaxValue(25)
        .setRequired(false)),

  async execute(interaction, database) {
    await interaction.deferReply();

    const limit = interaction.options.getInteger('limit') || 10;
    const guildId = interaction.guildId;

    try {
      const leaderboard = database.getLeaderboard(guildId, limit);

      if (leaderboard.length === 0) {
        return await interaction.editReply({
          content: '📋 No players in the leaderboard yet!\n\nPlayers will appear here after their first tracked match.',
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('🏆 Server ELO Leaderboard')
        .setDescription(`Top ${leaderboard.length} players ranked by ELO`)
        .setTimestamp();

      const medals = ['🥇', '🥈', '🥉'];

      const leaderboardText = leaderboard.map((player, index) => {
        const position = index + 1;
        const medal = medals[index] || `**${position}.**`;
        const eloRank = EloCalculator.getEloRank(player.elo);
        const winRate = player.matches_played > 0
          ? ((player.wins / player.matches_played) * 100).toFixed(1)
          : '0.0';
        const avgScore = player.matches_played > 0
          ? Math.round(player.total_score / player.matches_played)
          : 0;
        const avgKills = player.matches_played > 0
          ? (player.total_kills / player.matches_played).toFixed(1)
          : '0.0';

        return `${medal} **${player.game_name}#${player.tag_line}**\n` +
               `${eloRank.name} • ${player.elo} ELO\n` +
               `${player.matches_played} games • ${winRate}% WR • ${avgScore} avg score • ${avgKills} avg K\n`;
      }).join('\n');

      embed.addFields({
        name: '\u200b',
        value: leaderboardText,
        inline: false
      });

      // Add stats footer
      const totalMatches = leaderboard.reduce((sum, p) => sum + p.matches_played, 0);
      const topPlayer = leaderboard[0];
      const topEloRank = EloCalculator.getEloRank(topPlayer.elo);

      embed.setFooter({
        text: `${totalMatches} total matches tracked • Top player: ${topPlayer.game_name} (${topEloRank.name})`
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
