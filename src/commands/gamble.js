const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EloCalculator = require('../utils/eloCalculator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gamble')
		.setDescription('🎰 Mise ton ELO et tente ta chance!')
		.addIntegerOption(option =>
			option.setName('montant')
				.setDescription('Montant d\'ELO à miser')
				.setRequired(true)
				.setMinValue(1))
		.addNumberOption(option =>
			option.setName('multiplicateur')
				.setDescription('Multiplicateur de gains (x2, x3, x10...) - Plus c\'est haut, moins t\'as de chances!')
				.setRequired(true)
				.setMinValue(1.5)),

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;

		await interaction.deferReply();

		const amount = interaction.options.getInteger('montant');
		const multiplier = interaction.options.getNumber('multiplicateur');

		// Find the account linked to this Discord user
		const userAccount = database.getAccountByDiscordId(guildId, discordUserId);

		if (!userAccount) {
			return await interaction.editReply({
				content: `❌ Tu n'as pas de compte LoL lié!\n\n📝 **Nouveau compte?** → \`/register gamename:TonNom tag:EUW\`\n🔗 **Compte déjà enregistré?** → \`/link gamename:TonNom tag:EUW\``,
				ephemeral: true
			});
		}

		const gameName = userAccount.game_name;
		const tagLine = userAccount.tag_line;

		const playerElo = database.getPlayerElo(guildId, userAccount.puuid);

		if (!playerElo) {
			return await interaction.editReply({
				content: `❌ Tu n'as pas encore d'ELO. Joue une partie d'abord!`,
				ephemeral: true
			});
		}

		if (amount > playerElo.elo) {
			return await interaction.editReply({
				content: `❌ Tu n'as pas assez d'ELO!\nELO actuel: **${playerElo.elo}** | Mise demandée: **${amount}**`,
				ephemeral: true
			});
		}

		// Calculate win chance: 4% / (mult * (mult - 1)), max 20%
		const rawChance = 18 / (multiplier * (multiplier - 1.2));
		const winChance = Math.min(20, rawChance);
		const winChanceDisplay = winChance.toFixed(2);

		const potentialWin = Math.floor(amount * multiplier);
		const eloRank = EloCalculator.getEloRank(playerElo.elo);

		// Create initial embed
		const initialEmbed = new EmbedBuilder()
			.setColor('#FFA500')
			.setTitle('🎰 ROULETTE ELO')
			.setDescription(`**${interaction.user.username}** (${gameName}#${tagLine}) mise **${amount} ELO** avec un multiplicateur **x${multiplier}**!`)
			.addFields(
				{
					name: '💰 Mise',
					value: `\`\`\`${amount} ELO\`\`\``,
					inline: true
				},
				{
					name: '🎯 Gain potentiel',
					value: `\`\`\`+${potentialWin - amount} ELO\`\`\``,
					inline: true
				},
				{
					name: '📊 Chance de gagner',
					value: `\`\`\`${winChanceDisplay}%\`\`\``,
					inline: true
				}
			)
			.addFields({
				name: '\u200b',
				value: '🎲 **La roue tourne...**',
				inline: false
			})
			.setFooter({ text: `ELO actuel: ${playerElo.elo} • ${eloRank.name}` });

		await interaction.editReply({ embeds: [initialEmbed] });

		// Suspense delay
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Roll!
		const roll = Math.random() * 100;
		const won = roll < winChance;

		let resultEmbed;
		let newElo;

		if (won) {
			const eloGain = potentialWin - amount;
			newElo = playerElo.elo + eloGain;

			database.updatePlayerEloDirectly(guildId, userAccount.puuid, eloGain);

			const newRank = EloCalculator.getEloRank(newElo);

			resultEmbed = new EmbedBuilder()
				.setColor('#2ECC71')
				.setTitle('🎉 JACKPOT!')
				.setDescription(`**${interaction.user.username}** a gagné le pari x${multiplier}!`)
				.addFields(
					{
						name: '💰 Mise',
						value: `\`\`\`${amount} ELO\`\`\``,
						inline: true
					},
					{
						name: '🏆 Gains',
						value: `\`\`\`+${eloGain} ELO\`\`\``,
						inline: true
					},
					{
						name: '📊 Chance',
						value: `\`\`\`${winChanceDisplay}%\`\`\``,
						inline: true
					}
				)
				.addFields({
					name: '✨ Résultat',
					value: `**${playerElo.elo}** ➜ **${newElo}** ELO\n${newRank.name}`,
					inline: false
				})
				.setFooter({ text: `Roll: ${roll.toFixed(2)}% (fallait < ${winChanceDisplay}%)` })
				.setTimestamp();

		} else {
			newElo = playerElo.elo - amount;

			database.updatePlayerEloDirectly(guildId, userAccount.puuid, -amount);

			const newRank = EloCalculator.getEloRank(newElo);

			const reactions = [
				'💀 Aïe...',
				'😭 Pas de bol!',
				'🪦 RIP tes ELO',
				'📉 Dans le rouge!',
				'🤡 Clown moment'
			];
			const reaction = reactions[Math.floor(Math.random() * reactions.length)];

			resultEmbed = new EmbedBuilder()
				.setColor('#E74C3C')
				.setTitle(`${reaction}`)
				.setDescription(`**${interaction.user.username}** a perdu son pari x${multiplier}...`)
				.addFields(
					{
						name: '💰 Mise perdue',
						value: `\`\`\`-${amount} ELO\`\`\``,
						inline: true
					},
					{
						name: '🎯 Espoir',
						value: `\`\`\`+${potentialWin - amount} ELO\`\`\``,
						inline: true
					},
					{
						name: '📊 Chance',
						value: `\`\`\`${winChanceDisplay}%\`\`\``,
						inline: true
					}
				)
				.addFields({
					name: '📉 Résultat',
					value: `**${playerElo.elo}** ➜ **${newElo}** ELO\n${newRank.name}`,
					inline: false
				})
				.setFooter({ text: `Roll: ${roll.toFixed(2)}% (fallait < ${winChanceDisplay}%)` })
				.setTimestamp();
		}

		await interaction.editReply({ embeds: [resultEmbed] });
	}
};
