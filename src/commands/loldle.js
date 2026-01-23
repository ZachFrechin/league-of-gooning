const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');
const MatchImageGenerator = require('../utils/matchImageGenerator');

// Simplified LoLdle: Guess the champion from hints
// Hints: Gender, Position, Species, Resource, Range type, Region, Release Year
// We need champion data. We can fetch it from DDragon.

let CHAMPION_CACHE = null;
let CACHE_TIME = 0;

async function getChampions() {
	if (CHAMPION_CACHE && Date.now() - CACHE_TIME < 3600000 * 24) return CHAMPION_CACHE;

	const version = await MatchImageGenerator.getLatestVersion();
	const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/fr_FR/champion.json`;
	const response = await axios.get(url);
	const champs = Object.values(response.data.data);

	CHAMPION_CACHE = champs;
	CACHE_TIME = Date.now();
	return champs;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('loldle')
		.setDescription('🧩 Devine le champion du jour (1 fois/jour)'),

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;

		await interaction.deferReply({ ephemeral: true });

		// 1. Check Daily Attempt via DB
		// We select a "Daily Champion" deterministically based on date seed
		// So everyone has the same champion per day.
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const dateHash = today.split('-').join('');

		const champions = await getChampions();
		const seed = parseInt(dateHash) * 16381 + 7; // Simple hash
		const dailyIndex = seed % champions.length;
		const targetChamp = champions[dailyIndex];

		// Ensure user hasn't already solved it
		const userStatus = database.checkDailyAttempt(guildId, discordUserId);

		if (userStatus.solved) {
			return await interaction.editReply({
				content: `✅ Tu as déjà trouvé le champion du jour!\nC'était **${targetChamp.name}**.\nReviens demain!`
			});
		}

		// 2. Start Game Loop (within interaction)
		// Hints progressively revealed? Or just specific info?
		// Simpler LoLdle: Classic mode hints.
		// Gender, Position, Species, Resource, Range, Region, Year
		// DDragon data is limited (tags only).
		// Let's use Tags (Roles) + Resource (parttype) + Title + Blurb as clues.

		let attempts = 0;
		const maxAttempts = 5;
		let hints = [
			`🎭 Rôle(s): ${targetChamp.tags.join(', ')}`,
			`💧 Ressource: ${targetChamp.partype}`,
			`📜 Titre: ${targetChamp.title}`,
			`📝 Description: ${targetChamp.blurb.substring(0, 50)}...`,
			`🆔 Première lettre: ${targetChamp.name[0]}`
		];

		const embed = new EmbedBuilder()
			.setColor('#3498DB')
			.setTitle('🧩 LoLdle du Jour')
			.setDescription(`Devine le champion!\n\n**Indice 1:** ${hints[0]}`)
			.setFooter({ text: `Tentatives restantes: ${maxAttempts}` });

		const btnRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder().setCustomId('guess').setLabel('Faire une proposition').setStyle(ButtonStyle.Primary).setEmoji('💡')
		);

		const msg = await interaction.editReply({ embeds: [embed], components: [btnRow] });

		// Logic handled via modal input? Slash commands can't trigger modal from deferred reply easily usually.
		// Actually they can since djs v14 if we follow up.
		// But here we deferred. Interaction tokens valid 15min.
		// Best approach: Button triggers a Collector that asks for message input in channel. 
		// Or simpler: User types `/loldle guess:Name`? 
		// No, we want interactive session.
		// Let's use message collector in channel.

		const filter = m => m.author.id === interaction.user.id;
		const collector = interaction.channel.createMessageCollector({ filter, time: 60000 * 2 }); // 2 mins

		await interaction.followUp({ content: '✍️ Écris le nom du champion directement dans le chat!', ephemeral: true });

		collector.on('collect', async m => {
			const guess = m.content.trim().toLowerCase();
			const target = targetChamp.name.toLowerCase();
			attempts++;

			if (guess === target || guess === targetChamp.id.toLowerCase()) {
				collector.stop('win');
				// Calculate Reward: 50 - (attempts-1)*10. Min 10.
				const reward = Math.max(10, 50 - (attempts - 1) * 10);

				// Get linked account to give ELO
				const linkedAccount = database.getAccountByDiscordId(guildId, discordUserId);
				if (linkedAccount) {
					database.updatePlayerEloDirectly(guildId, linkedAccount.puuid, reward);
					database.markLoldleSolved(guildId, discordUserId);

					await m.reply(`🎉 **CORRECT!** C'était bien **${targetChamp.name}**.\n💰 Tu gagnes **+${reward} ELO**!`);
				} else {
					await m.reply(`🎉 **CORRECT!** C'était bien **${targetChamp.name}**.\n⚠️ Pas de compte lié = Pas d'ELO gagné (/link).`);
				}

			} else {
				if (attempts >= maxAttempts) {
					collector.stop('lose');
					await m.reply(`❌ Perdu! C'était **${targetChamp.name}**.`);
				} else {
					const nextHint = hints[attempts]; // attempts is 1-based index for next hint
					await m.reply(`❌ Pas ça! Nouvel indice:\n> ${nextHint || 'Plus d\'indices!'}\n(${maxAttempts - attempts} essais restants)`);
				}
			}
		});

		collector.on('end', (collected, reason) => {
			if (reason === 'time') {
				interaction.followUp({ content: '⏱️ Temps écoulé!', ephemeral: true });
			}
		});
	}
};
