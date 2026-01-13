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
			console.log(`[/match] Starting for ${gameName}#${tagLine} match ${matchId}`);

			// Get account PUUID
			const account = await riotApi.getAccountByRiotId(gameName, tagLine);
			console.log(`[/match] Got account PUUID`);

			// Fetch match data
			const matchData = await riotApi.getMatchDetails(matchId);
			console.log(`[/match] Got match data`);

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

			// Calculate score
			const score = MatchFormatter.calculateScore(
				participant,
				playerStats.gameDuration,
				playerStats.isRemake,
				allParticipants
			);
			console.log(`[/match] Score calculated: ${score}`);

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

			// Generate ONLY player image (faster)
			const files = [];
			try {
				console.log(`[/match] Generating player image...`);
				const matchImageBuffer = await MatchImageGenerator.generateMatchImage(participant, participant.win, score);
				files.push(new AttachmentBuilder(matchImageBuffer, { name: 'match-player.png' }));
				console.log(`[/match] Player image generated`);
			} catch (imgErr) {
				console.error('[/match] Failed to generate image:', imgErr.message);
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
					`🎮 **Match ID:** \`${matchId}\``
				);

			if (files.length > 0) {
				embed.setImage('attachment://match-player.png');
			}

			// Stats
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

			// Team compositions (text format for now - images too slow)
			const playerTeam = allParticipants.filter(p => p.teamId === participant.teamId);
			const enemyTeam = allParticipants.filter(p => p.teamId !== participant.teamId);

			const teamComp = MatchFormatter.formatTeamComposition(playerTeam, participant.puuid);
			const enemyComp = MatchFormatter.formatTeamComposition(enemyTeam, participant.puuid);

			embed.addFields(
				{
					name: '\u200b',
					value: '**═══════════ TEAMS ═══════════**',
					inline: false
				},
				{
					name: participant.win ? '🔵 Your Team (Victory)' : '🔵 Your Team (Defeat)',
					value: `\`\`\`\n${teamComp}\n\`\`\``,
					inline: true
				},
				{
					name: participant.win ? '🔴 Enemy Team (Defeat)' : '🔴 Enemy Team (Victory)',
					value: `\`\`\`\n${enemyComp}\n\`\`\``,
					inline: true
				}
			);

			embed.setTimestamp(matchData.info.gameEndTimestamp)
				.setFooter({ text: 'BETA Command' });

			console.log(`[/match] Sending reply...`);
			await interaction.editReply({ embeds: [embed], files: files });
			console.log(`[/match] Done!`);

		} catch (error) {
			console.error('[/match] Error:', error);
			await interaction.editReply({
				content: `❌ Error: ${error.message}`,
				ephemeral: true
			});
		}
	}
};
