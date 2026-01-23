const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EloCalculator = require('../utils/eloCalculator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('Display a player\'s League of Legends profile stats')
		.addStringOption(option =>
			option.setName('gamename')
				.setDescription('Game Name (without tag)')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('tag')
				.setDescription('Tag Line (e.g., EUW, NA1)')
				.setRequired(false)),

	async execute(interaction, database) {
		await interaction.deferReply();

		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;
		let gameName = interaction.options.getString('gamename');
		let tagLine = interaction.options.getString('tag');

		try {
			// If not provided, try to get linked account
			if (!gameName || !tagLine) {
				const linkedAccount = database.getAccountByDiscordId(guildId, discordUserId);
				if (!linkedAccount) {
					return await interaction.editReply({
						content: `❌ Tu n'as pas de compte lié. Utilise \`/link\` pour lier ton compte ou précise un nom et un tag (\`/profile gamename:Nom tag:Tag\`).`,
						ephemeral: true
					});
				}
				gameName = linkedAccount.game_name;
				tagLine = linkedAccount.tag_line;
			}

			// Find the tracked account
			const trackedAccount = database.getTrackedAccount(guildId, gameName, tagLine);

			if (!trackedAccount) {
				return await interaction.editReply({
					content: `❌ Player **${gameName}#${tagLine}** is not registered on this server.\nUse \`/register\` to add them first.`,
					ephemeral: true
				});
			}

			// Get ELO data
			const playerElo = database.getPlayerElo(guildId, trackedAccount.puuid);

			if (!playerElo) {
				return await interaction.editReply({
					content: `📋 **${gameName}#${tagLine}** has no match data yet.\nStats will appear after their first tracked match.`,
					ephemeral: true
				});
			}

			// Calculate averages
			// Calculate averages
			const matches = playerElo.matches_played || 1;
			// Use stats_matches if available (for stats added later), otherwise fallback to matches (legacy support)
			// But for legacy data (stats_matches=0), stats columns are likely 0 too, so it's safer to use stats_matches > 0 ? stats_matches : 1 (if total stats > 0)
			// To be safe: use stats_matches if > 0, otherwise if totals are > 0 use matches, else 1
			const statsDivisor = (playerElo.stats_matches && playerElo.stats_matches > 0) ? playerElo.stats_matches : matches;

			const avgScore = Math.round((playerElo.total_score || 0) / matches); // Score was always tracked
			const avgKills = ((playerElo.total_kills || 0) / matches).toFixed(1); // Kills always tracked
			const avgDeaths = ((playerElo.total_deaths || 0) / matches).toFixed(1); // Deaths always tracked
			const avgAssists = ((playerElo.total_assists || 0) / matches).toFixed(1); // Assists always tracked

			// New stats use specific divisor
			const avgDamage = Math.round((playerElo.total_damage || 0) / statsDivisor);
			const avgCS = Math.round((playerElo.total_cs || 0) / statsDivisor);
			const avgVision = ((playerElo.total_vision || 0) / statsDivisor).toFixed(1);

			const winRate = ((playerElo.wins || 0) / matches * 100).toFixed(1);

			const eloRank = EloCalculator.getEloRank(playerElo.elo);
			const streak = playerElo.current_streak || 0;
			const streakDisplay = streak > 0 ? `🔥 ${streak}W` : streak < 0 ? `💀 ${Math.abs(streak)}L` : '➖ 0';

			const embed = new EmbedBuilder()
				.setColor(eloRank.color)
				.setTitle(`📊 Profile: ${gameName}#${tagLine}`)
				.setDescription(`${eloRank.name} • **${playerElo.elo} ELO**`)
				.addFields(
					{
						name: '🎮 Matches',
						value: `\`\`\`\n${matches} Games\n${playerElo.wins}W / ${playerElo.losses}L\n${winRate}% WR\n\`\`\``,
						inline: true
					},
					{
						name: '📈 Streaks',
						value: `\`\`\`\nCurrent: ${streakDisplay}\nBest Win: 🔥 ${playerElo.best_win_streak || 0}\nWorst Lose: 💀 ${Math.abs(playerElo.worst_lose_streak || 0)}\n\`\`\``,
						inline: true
					},
					{
						name: '🏆 Peak ELO',
						value: `\`\`\`\n${playerElo.peak_elo || playerElo.elo}\n\`\`\``,
						inline: true
					},
					{
						name: '\u200b',
						value: '**═══════════ AVERAGE STATS ═══════════**',
						inline: false
					},
					{
						name: '⚔️ Avg KDA',
						value: `\`\`\`\n${avgKills}/${avgDeaths}/${avgAssists}\n\`\`\``,
						inline: true
					},
					{
						name: '📊 Avg Score',
						value: `\`\`\`\n${avgScore}/100\n\`\`\``,
						inline: true
					},
					{
						name: '💥 Avg Damage',
						value: `\`\`\`\n${avgDamage.toLocaleString()}\n\`\`\``,
						inline: true
					},
					{
						name: '🗡️ Avg CS',
						value: `\`\`\`\n${avgCS}\n\`\`\``,
						inline: true
					},
					{
						name: '👁️ Avg Vision',
						value: `\`\`\`\n${avgVision}\n\`\`\``,
						inline: true
					},
					{
						name: '🎯 Total Kills',
						value: `\`\`\`\n${playerElo.total_kills || 0}\n\`\`\``,
						inline: true
					}
				)
				.setTimestamp()
				.setFooter({ text: `Server ELO System` });

			await interaction.editReply({ embeds: [embed] });
		} catch (error) {
			console.error('Error fetching profile:', error);
			await interaction.editReply({
				content: `❌ Error: ${error.message}`,
				ephemeral: true
			});
		}
	}
};
