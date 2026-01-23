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

			// 2. Get Match History (20 IDs) -> Filter to 10
			const matchIds = await riotApi.getMatchIds(account.puuid);
			const recentMatchIds = matchIds.slice(0, 10);

			// 3. Get Details for each match (Parallel)
			const matches = await Promise.all(recentMatchIds.map(async (matchId) => {
				try {
					const details = await riotApi.getMatchDetails(matchId);
					const participant = details.info.participants.find(p => p.puuid === account.puuid);
					if (!participant) return null;
					return {
						kills: participant.kills,
						deaths: participant.deaths,
						assists: participant.assists,
						championName: participant.championName,
						champLevel: participant.champLevel,
						win: participant.win,
						gameDuration: details.info.gameDuration,
						gameEndTimestamp: details.info.gameEndTimestamp,
						gameMode: details.info.gameMode,
						items: [participant.item0, participant.item1, participant.item2] // Just first 3 for simplicity or preloading
					};
				} catch (e) {
					return null;
				}
			}));

			const validMatches = matches.filter(m => m !== null);

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
