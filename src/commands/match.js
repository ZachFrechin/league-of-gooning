const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const MatchFormatter = require('../utils/matchFormatter');
const MatchImageGenerator = require('../utils/matchImageGenerator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('match')
		.setDescription('[BETA] Display details of a specific match with generated image')
		.addStringOption(option =>
			option.setName('matchid')
				.setDescription('Match ID (e.g., EUW1_1234567890)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('gamename')
				.setDescription('Game Name of player to focus on')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('tag')
				.setDescription('Tag Line (e.g., EUW)')
				.setRequired(true)),

	async execute(interaction, database, riotApi) {
		await interaction.deferReply();

		const matchId = interaction.options.getString('matchid');
		const gameName = interaction.options.getString('gamename');
		const tagLine = interaction.options.getString('tag');

		try {
			// Get account PUUID
			const account = await riotApi.getAccountByRiotId(gameName, tagLine);

			// Fetch match data
			const matchData = await riotApi.getMatchDetails(matchId);

			if (!matchData) {
				return await interaction.editReply({
					content: `❌ Match **${matchId}** not found.`,
					ephemeral: true
				});
			}

			// Get player stats from match
			const playerStats = riotApi.getPlayerStats(matchData, account.puuid);
			const participant = playerStats.participant;
			const allParticipants = matchData.info.participants;

			// Calculate score (for display only, not saved)
			const score = MatchFormatter.calculateScore(
				participant,
				playerStats.gameDuration,
				playerStats.isRemake,
				allParticipants
			);

			// Generate match image (BETA feature)
			let attachment = null;
			try {
				const imageBuffer = await MatchImageGenerator.generateMatchImage(participant, participant.win, score);
				attachment = new AttachmentBuilder(imageBuffer, { name: 'match-summary.png' });
			} catch (imgError) {
				console.error('Failed to generate match image:', imgError.message);
				// Continue without image
			}

			// Build the embed
			const color = participant.win ? '#3498db' : '#e74c3c';
			const result = participant.win ? '🏆 VICTORY' : '💀 DEFEAT';
			const duration = MatchFormatter.formatDuration(playerStats.gameDuration);
			const queueType = MatchFormatter.getQueueType(playerStats.queueId);

			const kda = `${participant.kills}/${participant.deaths}/${participant.assists}`;
			const kdaRatio = participant.deaths === 0
				? (participant.kills + participant.assists).toFixed(2)
				: ((participant.kills + participant.assists) / participant.deaths).toFixed(2);

			const totalCS = participant.totalMinionsKilled + participant.neutralMinionsKilled;
			const csPerMin = (totalCS / (playerStats.gameDuration / 60)).toFixed(1);
			const damagePerMin = Math.round(participant.totalDamageDealtToChampions / (playerStats.gameDuration / 60));

			// Build embed
			const embed = new EmbedBuilder()
				.setColor(color)
				.setAuthor({
					name: `${gameName}#${tagLine}`,
					iconURL: MatchFormatter.getChampionIconUrl(participant.championName)
				})
				.setTitle(`${result} - ${queueType}`)
				.setDescription(
					`**${participant.championName}** • Level ${participant.champLevel} • ${duration}\n` +
					`🎮 **Match ID:** \`${matchId}\`\n` +
					`⚠️ *BETA - No ELO changes applied*`
				);

			// If image was generated, use it as the main image
			if (attachment) {
				embed.setImage('attachment://match-summary.png');
			} else {
				embed.setThumbnail(MatchFormatter.getChampionIconUrl(participant.championName));
			}

			embed.addFields(
				{
					name: '📊 Performance Score',
					value: `**${score}/100 Points**`,
					inline: false
				},
				{
					name: '⚔️ KDA',
					value: `\`\`\`\n${kda}\nRatio: ${kdaRatio}\n\`\`\``,
					inline: true
				},
				{
					name: '💰 Farm',
					value: `\`\`\`\n${totalCS} CS\n${csPerMin}/min\n\`\`\``,
					inline: true
				},
				{
					name: '💥 Damage',
					value: `\`\`\`\n${participant.totalDamageDealtToChampions.toLocaleString()}\n${damagePerMin}/min\n\`\`\``,
					inline: true
				}
			);

			// Add team compositions
			const playerTeam = allParticipants.filter(p => p.teamId === participant.teamId);
			const enemyTeam = allParticipants.filter(p => p.teamId !== participant.teamId);

			const teamComposition = MatchFormatter.formatTeamComposition(playerTeam, participant.puuid);
			const enemyComposition = MatchFormatter.formatTeamComposition(enemyTeam, participant.puuid);

			embed.addFields(
				{
					name: '\u200b',
					value: '**═══════════ TEAMS ═══════════**',
					inline: false
				},
				{
					name: participant.win ? '🔵 Your Team (Victory)' : '🔵 Your Team (Defeat)',
					value: `\`\`\`\n${teamComposition}\n\`\`\``,
					inline: true
				},
				{
					name: participant.win ? '🔴 Enemy Team (Defeat)' : '🔴 Enemy Team (Victory)',
					value: `\`\`\`\n${enemyComposition}\n\`\`\``,
					inline: true
				}
			);

			embed.setTimestamp(matchData.info.gameEndTimestamp)
				.setFooter({ text: 'BETA Command - Generated with node-canvas' });

			// Send with or without image attachment
			const replyOptions = { embeds: [embed] };
			if (attachment) {
				replyOptions.files = [attachment];
			}

			await interaction.editReply(replyOptions);

		} catch (error) {
			console.error('Error in /match command:', error);
			await interaction.editReply({
				content: `❌ Error: ${error.message}`,
				ephemeral: true
			});
		}
	},

	// Helper to get summoner spell name
	getSummonerName(id) {
		const summoners = {
			1: 'Cleanse', 3: 'Exhaust', 4: 'Flash', 6: 'Ghost',
			7: 'Heal', 11: 'Smite', 12: 'Teleport', 14: 'Ignite',
			21: 'Barrier', 32: 'Snowball'
		};
		return summoners[id] || `Spell${id}`;
	}
};
