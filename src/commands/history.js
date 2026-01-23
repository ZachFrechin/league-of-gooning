const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const MatchImageGenerator = require('../utils/matchImageGenerator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('history')
		.setDescription('📜 Affiche l\'historique des 10 derniers matchs (Image)')
		.addStringOption(option =>
			option.setName('gamename')
				.setDescription('Nom du joueur'))
		.addStringOption(option =>
			option.setName('tag')
				.setDescription('Tag Line (ex: EUW)')),

	async execute(interaction, database, riotApi) {
		await interaction.deferReply();

		let gameName = interaction.options.getString('gamename');
		let tagLine = interaction.options.getString('tag');

		if (!gameName || !tagLine) {
			const linkedAccount = database.getAccountByDiscordId(interaction.guildId, interaction.user.id);
			if (linkedAccount) {
				gameName = linkedAccount.game_name;
				tagLine = linkedAccount.tag_line;
			} else {
				return await interaction.editReply({
					content: `❌ Tu dois spécifier un joueur ou lier ton compte avec \`/link\`.`
				});
			}
		}

		try {
			// 1. Get Account
			const account = await riotApi.getAccountByRiotId(gameName, tagLine);

			// 2. Get Match History (Fetch more to allow filtering)
			const allMatchIds = await riotApi.getMatchIds(account.puuid, 50); // Fetch 50 instead of 20

			// 3. Filter for Ranked and get details
			const validMatches = [];

			// Process sequentially or in batches to find 10 ranked matches
			for (const matchId of allMatchIds) {
				if (validMatches.length >= 10) break;

				try {
					const details = await riotApi.getMatchDetails(matchId);

					// Filter: Only 420 (Solo) or 440 (Flex)
					if (details.info.queueId !== 420 && details.info.queueId !== 440) {
						continue;
					}

					const participant = details.info.participants.find(p => p.puuid === account.puuid);
					if (!participant) continue;

					// Localized Queue Name
					let gameMode = details.info.gameMode;
					const queueId = details.info.queueId;
					if (queueId === 420) gameMode = 'RANKED SOLO';
					else if (queueId === 440) gameMode = 'RANKED FLEX';

					// Get stored performance score if available
					const perfScore = database.getMatchPerformanceScore(interaction.guildId, matchId, account.puuid);

					validMatches.push({
						kills: participant.kills,
						deaths: participant.deaths,
						assists: participant.assists,
						championName: participant.championName,
						champLevel: participant.champLevel,
						win: participant.win,
						gameDuration: details.info.gameDuration,
						gameEndTimestamp: details.info.gameEndTimestamp,
						gameMode: gameMode,
						performanceScore: perfScore,
						items: [
							participant.item0, participant.item1, participant.item2,
							participant.item3, participant.item4, participant.item5,
							participant.item6
						]
					});
				} catch (e) {
					console.error(`Failed to fetch/process match ${matchId}:`, e.message);
				}
			}

			// 4. Generate Image
			const imageBuffer = await MatchImageGenerator.generateHistoryImage(gameName, validMatches);
			const attachment = new AttachmentBuilder(imageBuffer, { name: 'history.png' });

			const embed = new EmbedBuilder()
				.setColor('#F1C40F')
				.setTitle(`📜 Historique: ${gameName}#${tagLine}`)
				.setImage('attachment://history.png')
				.setTimestamp();

			await interaction.editReply({ embeds: [embed], files: [attachment] });

		} catch (error) {
			console.error(error);
			await interaction.editReply({ content: `❌ Erreur: ${error.message}` });
		}
	}
};
