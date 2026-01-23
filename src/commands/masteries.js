const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const MatchImageGenerator = require('../utils/matchImageGenerator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('masteries')
		.setDescription('🎨 Affiche les 10 meilleurs champions d\'un joueur (Image)')
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

		// Auto-detect if not provided
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

			// 2. Get Champion Masteries
			const masteries = await riotApi.getChampionMasteries(account.puuid);

			if (!masteries || masteries.length === 0) {
				return await interaction.editReply({ content: `❌ Aucune maîtrise trouvée pour **${gameName}#${tagLine}**.` });
			}

			// 3. Enrich Mastery Data with Champion Names (needed for image)
			// We need to fetch champion list or use a static map. 
			// Ideally existing riotApi has a method or we fetch latest DDragon.
			// Let's use the DDragon fetching logic similar to match processing or verify if riotApi exposes it.
			// For now, I will assume we can fetch DDragon data here or RiotAPI helper can do it.
			// I'll implement a quick fetch here to be safe.
			const version = await MatchImageGenerator.getLatestVersion();
			const championDataUrl = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`;
			const axios = require('axios');
			const champResponse = await axios.get(championDataUrl);
			const champions = Object.values(champResponse.data.data);

			const enrichedMasteries = masteries.map(m => {
				// Mastery API returns championId (long), DDragon uses string keys mostly matching but let's check 'key' property
				const champ = champions.find(c => c.key == m.championId);
				return {
					...m,
					championName: champ ? champ.id : 'Unknown'
				};
			});

			// 4. Generate Image
			const imageBuffer = await MatchImageGenerator.generateMasteryImage(gameName, enrichedMasteries);
			const attachment = new AttachmentBuilder(imageBuffer, { name: 'masteries.png' });

			const embed = new EmbedBuilder()
				.setColor('#0AC8B9')
				.setTitle(`🏆 Maîtrises: ${gameName}#${tagLine}`)
				.setImage('attachment://masteries.png')
				.setTimestamp();

			await interaction.editReply({ embeds: [embed], files: [attachment] });

		} catch (error) {
			console.error(error);
			await interaction.editReply({ content: `❌ Erreur: ${error.message}` });
		}
	}
};
