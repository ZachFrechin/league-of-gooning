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
			// Find if player is registered to get their region
			let trackedAccount = database.getTrackedAccount(interaction.guildId, gameName, tagLine);

			// If not found by name, try to find by Discord ID if no params were provided
			if (!trackedAccount && !interaction.options.getString('gamename')) {
				trackedAccount = database.getAccountByDiscordId(interaction.guildId, interaction.user.id);
			}

			const region = trackedAccount ? trackedAccount.region : null;
			console.log(`[Ranks] Fetching for ${gameName}#${tagLine} (Region: ${region || 'default'})`);

			// 1. Get Account
			const account = await riotApi.getAccountByRiotId(gameName, tagLine);

			// 2. Get Ranks
			const summoner = await riotApi.getSummonerByPuuid(account.puuid, region);
			const leagueEntries = await riotApi.getLeagueEntries(summoner.id, region);

			console.log(`[Ranks] Found ${leagueEntries.length} entries for ${gameName}#${tagLine}`);
			if (leagueEntries.length > 0) {
				leagueEntries.forEach(e => console.log(` - ${e.queueType}: ${e.tier} ${e.rank}`));
			}

			// 3. Generate Image
			const imageBuffer = await MatchImageGenerator.generateRanksImage(gameName, leagueEntries);
			const attachment = new AttachmentBuilder(imageBuffer, { name: 'ranks.png' });

			const embed = new EmbedBuilder()
				.setColor('#F1C40F')
				.setTitle(`🏅 Rangs: ${gameName}#${tagLine}`)
				.setImage('attachment://ranks.png')
				.setTimestamp()
				.setFooter({ text: `Région: ${region || 'default (' + riotApi.region + ')'}` });

			await interaction.editReply({ embeds: [embed], files: [attachment] });

		} catch (error) {
			console.error(error);
			await interaction.editReply({ content: `❌ Erreur: ${error.message}` });
		}
	}
};
