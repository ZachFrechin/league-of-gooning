const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EloCalculator = require('../utils/eloCalculator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gamble')
		.setDescription('🎰 Mise ton ELO et tente ta chance!')
		.addStringOption(option =>
			option.setName('gamename')
				.setDescription('Nom du joueur (sans le tag)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('tag')
				.setDescription('Tag Line (ex: EUW)')
				.setRequired(true))
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

		await interaction.deferReply();

		const gameName = interaction.options.getString('gamename');
		const tagLine = interaction.options.getString('tag');
		const amount = interaction.options.getInteger('montant');
		const multiplier = interaction.options.getNumber('multiplicateur');

		// Find tracked account
		const userAccount = database.getTrackedAccount(guildId, gameName, tagLine);

		if (!userAccount) {
			return await interaction.editReply({
				content: `❌ Le joueur **${gameName}#${tagLine}** n'est pas enregistré! Utilise \`/register\` d'abord.`,
				ephemeral: true
			});
		}

		const playerElo = database.getPlayerElo(guildId, userAccount.puuid);

		if (!playerElo) {
			return await interaction.editReply({
				content: `❌ **${gameName}#${tagLine}** n'a pas encore d'ELO. Joue une partie d'abord!`,
				ephemeral: true
			});
		}

		if (amount > playerElo.elo) {
			return await interaction.editReply({
				content: `❌ **${gameName}#${tagLine}** n'a pas assez d'ELO!\nELO actuel: **${playerElo.elo}** | Mise demandée: **${amount}**`,
				ephemeral: true
			});
		}

		// Calculate win chance: 4% / (mult * (mult - 1)), max 20%
		// x2 = 4/(2*1) = 2%
		// x3 = 4/(3*2) = 0.67%
		// x1.5 = 4/(1.5*0.5) = 5.33%
		const rawChance = 4 / (multiplier * (multiplier - 1));
		const winChance = Math.min(20, rawChance);
		const winChanceDisplay = winChance.toFixed(2);

		const potentialWin = Math.floor(amount * multiplier);
		const eloRank = EloCalculator.getEloRank(playerElo.elo);

		// Create initial embed with suspense
		const initialEmbed = new EmbedBuilder()
			.setColor('#FFA500')
			.setTitle('🎰 ROULETTE ELO')
			.setDescription(`**${gameName}#${tagLine}** mise **${amount} ELO** avec un multiplicateur **x${multiplier}**!`)
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

		// Add suspense delay
		await new Promise(resolve => setTimeout(resolve, 2000));

		// Roll the dice!
		const roll = Math.random() * 100;
		const won = roll < winChance;

		let resultEmbed;
		let newElo;

		if (won) {
			// WIN!
			const eloGain = potentialWin - amount;
			newElo = playerElo.elo + eloGain;

			database.updatePlayerEloDirectly(guildId, userAccount.puuid, eloGain);

			const newRank = EloCalculator.getEloRank(newElo);

			resultEmbed = new EmbedBuilder()
				.setColor('#2ECC71')
				.setTitle('🎉 JACKPOT!')
				.setDescription(`**${gameName}#${tagLine}** a gagné le pari x${multiplier}!`)
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
			// LOSE
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
				.setDescription(`**${gameName}#${tagLine}** a perdu son pari x${multiplier}...`)
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
