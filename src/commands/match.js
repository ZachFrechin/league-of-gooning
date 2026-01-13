const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const MatchFormatter = require('../utils/matchFormatter');
const MatchImageGenerator = require('../utils/matchImageGenerator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('match')
		.setDescription('[BETA] Display details of a specific match with generated images')
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

			// Prepare data
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
			const visionPerMin = (participant.visionScore / (playerStats.gameDuration / 60)).toFixed(1);
			const damagePerMin = Math.round(participant.totalDamageDealtToChampions / (playerStats.gameDuration / 60));

			const killParticipation = participant.challenges?.killParticipation
				? `${(participant.challenges.killParticipation * 100).toFixed(1)}%`
				: 'N/A';

			// Generate images
			const files = [];

			// 1. Player Match Image
			try {
				const matchImageBuffer = await MatchImageGenerator.generateMatchImage(participant, participant.win, score);
				files.push(new AttachmentBuilder(matchImageBuffer, { name: 'match-player.png' }));
			} catch (imgErr) {
				console.error('Failed to generate match image:', imgErr.message);
			}

			// 2. Team Images
			const playerTeam = allParticipants.filter(p => p.teamId === participant.teamId);
			const enemyTeam = allParticipants.filter(p => p.teamId !== participant.teamId);

			try {
				const allyImageBuffer = await MatchImageGenerator.generateTeamImage(playerTeam, participant.win, participant.puuid);
				files.push(new AttachmentBuilder(allyImageBuffer, { name: 'team-ally.png' }));
			} catch (imgErr) {
				console.error('Failed to generate ally team image:', imgErr.message);
			}

			try {
				const enemyImageBuffer = await MatchImageGenerator.generateTeamImage(enemyTeam, !participant.win, null);
				files.push(new AttachmentBuilder(enemyImageBuffer, { name: 'team-enemy.png' }));
			} catch (imgErr) {
				console.error('Failed to generate enemy team image:', imgErr.message);
			}

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

			// Use player image as main image if generated
			if (files.length > 0) {
				embed.setImage('attachment://match-player.png');
			}

			// Stats fields (same as auto match recaps)
			embed.addFields(
				{
					name: '\u200b',
					value: '**═══════════ YOUR STATS ═══════════**',
					inline: false
				},
				{
					name: '⚔️ KDA',
					value: `\`\`\`\n${kda}\nRatio: ${kdaRatio}\n\`\`\``,
					inline: true
				},
				{
					name: '🎯 Kill Participation',
					value: `\`\`\`\n${killParticipation}\n\`\`\``,
					inline: true
				},
				{
					name: '💥 Damage',
					value: `\`\`\`\n${(participant.totalDamageDealtToChampions || 0).toLocaleString()}\n${damagePerMin}/min\n\`\`\``,
					inline: true
				},
				{
					name: '🗡️ Farm (CS)',
					value: `\`\`\`\n${totalCS} CS\n${csPerMin}/min\n\`\`\``,
					inline: true
				},
				{
					name: '👁️ Vision',
					value: `\`\`\`\n${participant.visionScore}\n${visionPerMin}/min\n\`\`\``,
					inline: true
				},
				{
					name: '💰 Gold',
					value: `\`\`\`\n${(participant.goldEarned || 0).toLocaleString()}\n\`\`\``,
					inline: true
				}
			);

			// Team composition section (using images)
			embed.addFields({
				name: '\u200b',
				value: '**═══════════ TEAM COMPOSITIONS ═══════════**\n*See attached images below*',
				inline: false
			});

			embed.setTimestamp(matchData.info.gameEndTimestamp)
				.setFooter({ text: 'BETA Command - Generated with node-canvas' });

			// Send with all images
			await interaction.editReply({
				embeds: [embed],
				files: files
			});

		} catch (error) {
			console.error('Error in /match command:', error);
			await interaction.editReply({
				content: `❌ Error: ${error.message}`,
				ephemeral: true
			});
		}
	}
};
