const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const loldleService = require('../services/loldleService');
const MatchImageGenerator = require('../utils/matchImageGenerator');

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
				const attempts = guesses.length;
				const statsBefore = database.getLoldleStats(guildId, discordUserId);
				const isNewRecord = attempts < (statsBefore.best_guesses || 999);

				database.markLoldleSolved(guildId, discordUserId);
				database.incrementLoldleStats(guildId, discordUserId, attempts);

				const statsAfter = database.getLoldleStats(guildId, discordUserId);

				// Reward
				const reward = Math.max(10, 50 - (attempts - 1) * 5);
				const linkedAccount = database.getAccountByDiscordId(guildId, discordUserId);

				let rewardText = "";
				if (linkedAccount) {
					database.updatePlayerEloDirectly(guildId, linkedAccount.puuid, reward);
					rewardText = `\n💰 Tu gagnes **+${reward} ELO**!`;
				} else {
					rewardText = `\n⚠️ Pas de compte lié = Pas d'ELO gagné (/link).`;
				}

				// Generate result for winner (Private)
				const { embed: winnerEmbed, attachment: winnerAttachment } = await this.generateResult(guesses, targetChamp, true, database, discordUserId, guildId);
				winnerEmbed.setTitle('🎉 Félicitations ! Tu as trouvé !')
					.setDescription(`C'était bien **${targetChamp.name}** !\n\nTentatives: **${attempts}**\nStreak Actuelle: \`${statsAfter.current_streak}\` jours\nRecord Personnel: \`${statsAfter.best_guesses}\` essais\n${rewardText}`);

				// Announcement (Public - No Spoilers)
				const announcementEmbed = new EmbedBuilder()
					.setTitle('🧩 LoLdle du Jour : Un champion a été trouvé !')
					.setColor('#F1C40F')
					.setDescription(`<@${discordUserId}> a trouvé le champion du jour en **${attempts}** tentatives ! 🏆`)
					.addFields(
						{ name: '🔥 Streak', value: `\`${statsAfter.current_streak}\` jours`, inline: true },
						{ name: '⭐ Record', value: isNewRecord ? `✨ **NOUVEAU !!** (**${attempts}**)` : `\`${statsAfter.best_guesses}\` essais`, inline: true }
					)
					.setFooter({ text: 'Teste tes connaissances avec /loldle' })
					.setTimestamp();

				// Send public announcement
				await interaction.channel.send({ embeds: [announcementEmbed] });

				// Send private result to user
				return await interaction.editReply({
					embeds: [winnerEmbed],
					files: winnerAttachment ? [winnerAttachment] : []
				});
			}
		}

		const { embed, attachment } = await this.generateResult(guesses, targetChamp, userStatus.solved, database, discordUserId, guildId);

		await interaction.editReply({
			embeds: [embed],
			files: attachment ? [attachment] : []
		});
	},

	async generateResult(guesses, targetChamp, isSolved, database, discordUserId, guildId) {
		const stats = database.getLoldleStats(guildId, discordUserId);
		const streakText = `\`Current Score: ${stats.current_streak}\` \`Best Score: ${stats.best_streak}\``;

		const embed = new EmbedBuilder()
			.setTitle('🧩 LoLdle du Jour - Mode Classique')
			.setColor(isSolved ? '#2ECC71' : '#3498DB')
			.setDescription(`${streakText}\n\n${guesses.length > 0 ? `Tentatives: **${guesses.length}**` : 'Devine le champion en tapant son nom avec la commande `/loldle` !'}`)
			.setTimestamp();

		let attachment = null;

		if (guesses.length > 0) {
			// Generate comparisons for the image
			const attempts = guesses.map(g => loldleService.compare(g.champion_name, targetChamp)).filter(a => a !== null);

			if (attempts.length > 0) {
				const imageBuffer = await MatchImageGenerator.generateLoldleImage(attempts);
				attachment = new AttachmentBuilder(imageBuffer, { name: 'loldle-history.png' });
				embed.setImage('attachment://loldle-history.png');
			}
		}

		if (isSolved) {
			const version = await MatchImageGenerator.getLatestVersion();
			// Clean name for DDragon
			let champId = targetChamp.name.replace(/[^a-zA-Z]/g, '');

			// Handle special cases for thumbnails
			if (targetChamp.name === "LeBlanc") champId = "Leblanc";
			if (targetChamp.name === "Wukong") champId = "MonkeyKing";
			if (targetChamp.name === "Nunu & Willump") champId = "Nunu";
			if (targetChamp.name === "Fiddlesticks") champId = "Fiddlesticks"; // Ensure correct casing just in case

			embed.setThumbnail(`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champId}.png`);
		}

		return { embed, attachment };
	}
};
