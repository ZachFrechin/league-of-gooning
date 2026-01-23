const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const MatchImageGenerator = require('../utils/matchImageGenerator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ranks')
		.setDescription('🏅 Affiche les rangs Solo/Duo et Flex (Image)')
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

			// 2. Get Ranks
			// The account object from getAccountByRiotId (v1) only gives PUUID, gameName, tagLine.
			// We need summonerId for league-v4 (ranks).
			const summoner = await riotApi.getSummonerByPuuid(account.puuid);
			const leagueEntries = await riotApi.getLeagueEntries(summoner.id);

			// 3. Generate Image
			const imageBuffer = await MatchImageGenerator.generateRanksImage(gameName, leagueEntries);
			const attachment = new AttachmentBuilder(imageBuffer, { name: 'ranks.png' });

			const embed = new EmbedBuilder()
				.setColor('#F1C40F')
				.setTitle(`🏅 Rangs: ${gameName}#${tagLine}`)
				.setImage('attachment://ranks.png')
				.setTimestamp();

			await interaction.editReply({ embeds: [embed], files: [attachment] });

		} catch (error) {
			console.error(error);
			await interaction.editReply({ content: `❌ Erreur: ${error.message}` });
		}
	}
};
