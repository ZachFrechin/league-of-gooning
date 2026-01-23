const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const loldleService = require('../services/loldleService');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('loldle')
		.setDescription('🧩 Devine le champion du jour (Classic Mode)')
		.addStringOption(option =>
			option.setName('champion')
				.setDescription('Le nom du champion à deviner')
				.setAutocomplete(true)),

	async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused().toLowerCase();
		const choices = loldleService.champions.map(c => c.name);
		const filtered = choices
			.filter(choice => choice.toLowerCase().includes(focusedValue))
			.slice(0, 25);

		await interaction.respond(
			filtered.map(choice => ({ name: choice, value: choice }))
		);
	},

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;
		const championGuess = interaction.options.getString('champion');

		await interaction.deferReply({ ephemeral: true });

		const targetChamp = loldleService.getDailyChampion();
		const userStatus = database.checkDailyAttempt(guildId, discordUserId);

		// Get existing guesses
		let guesses = database.getLoldleGuesses(guildId, discordUserId);

		if (championGuess) {
			if (userStatus.solved) {
				return await interaction.editReply({
					content: `✅ Tu as déjà trouvé le champion du jour! C'était **${targetChamp.name}**.`
				});
			}

			const guessChamp = loldleService.getChampionByName(championGuess);
			if (!guessChamp) {
				return await interaction.editReply({ content: `❌ Champion "${championGuess}" inconnu.` });
			}

			// Check if already guessed
			if (guesses.some(g => g.champion_name.toLowerCase() === championGuess.toLowerCase())) {
				return await interaction.editReply({ content: `⚠️ Tu as déjà essayé ce champion!` });
			}

			// Add new guess
			database.addLoldleGuess(guildId, discordUserId, guessChamp.name);
			guesses.push({ champion_name: guessChamp.name });

			// Check if correct
			if (guessChamp.name === targetChamp.name) {
				database.markLoldleSolved(guildId, discordUserId);

				// Reward
				const attempts = guesses.length;
				const reward = Math.max(10, 50 - (attempts - 1) * 5);
				const linkedAccount = database.getAccountByDiscordId(guildId, discordUserId);

				let rewardText = "";
				if (linkedAccount) {
					database.updatePlayerEloDirectly(guildId, linkedAccount.puuid, reward);
					rewardText = `\n💰 Tu gagnes **+${reward} ELO**!`;
				} else {
					rewardText = `\n⚠️ Pas de compte lié = Pas d'ELO gagné (/link).`;
				}

				const embed = this.generateEmbed(guesses, targetChamp, true);
				return await interaction.editReply({
					content: `🎉 **VICTOIRE!** C'était bien **${targetChamp.name}**!${rewardText}`,
					embeds: [embed]
				});
			}
		}

		const embed = this.generateEmbed(guesses, targetChamp, userStatus.solved);

		await interaction.editReply({
			embeds: [embed]
		});
	},

	generateEmbed(guesses, targetChamp, isSolved) {
		const embed = new EmbedBuilder()
			.setTitle('🧩 LoLdle du Jour - Mode Classique')
			.setColor(isSolved ? '#2ECC71' : '#3498DB')
			.setDescription(guesses.length > 0 ? `Tentatives: **${guesses.length}**` : 'Devine le champion en tapant son nom avec `/loldle guess` !')
			.setTimestamp();

		if (guesses.length > 0) {
			const rows = guesses.map(g => {
				const comparison = loldleService.compare(g.champion_name, targetChamp);
				if (!comparison) return "";

				return `**${comparison.champion.name}**\n` +
					`🚻${loldleService.getEmoji(comparison.gender)} ` +
					`📍${loldleService.getEmoji(comparison.positions)} ` +
					`🧬${loldleService.getEmoji(comparison.species)} ` +
					`💧${loldleService.getEmoji(comparison.resource)} ` +
					`📏${loldleService.getEmoji(comparison.rangeType)} ` +
					`🌍${loldleService.getEmoji(comparison.regions)} ` +
					`📅${loldleService.getEmoji(comparison.year)}`;
			}).reverse(); // Last guess on top

			// Discord limit check (can't have too many)
			const displayRows = rows.slice(0, 10);

			embed.addFields({
				name: 'Historique (Récent en haut)',
				value: displayRows.join('\n\n') || 'Aucune'
			});

			if (rows.length > 10) {
				embed.setFooter({ text: `... et ${rows.length - 10} tentatives précédentes.` });
			}
		}

		embed.addFields({
			name: 'Légende',
			value: '🚻 Gen | 📍 Pos | 🧬 Spe | 💧 Res | 📏 Ran | 🌍 Reg | 📅 An'
		});

		if (isSolved) {
			// Clean name for DDragon: remove spaces, apostrophes, and fix capitalization
			let champId = targetChamp.name
				.replace("'", "")
				.replace(" ", "")
				.replace("&", "")
				.replace(".", "");

			// Special cases
			if (champId === "NunuWillump") champId = "Nunu";
			if (champId === "Wukong") champId = "MonkeyKing";
			if (champId === "LeBlanc") champId = "Leblanc";
			if (champId === "KaiSa") champId = "Kaisa";
			if (champId === "KhaZix") champId = "Khazix";
			if (champId === "ChoGath") champId = "Chogath";
			if (champId === "VelKoz") champId = "Velkoz";
			if (champId === "BelVeth") champId = "Belveth";

			embed.setThumbnail(`https://ddragon.leagueoflegends.com/cdn/14.2.1/img/champion/${champId}.png`);
			embed.setImage(`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champId}_0.jpg`);
		}

		return embed;
	}
};
