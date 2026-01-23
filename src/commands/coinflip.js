const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EloCalculator = require('../utils/eloCalculator');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('coinflip')
		.setDescription('🪙 Pile ou Face - Double ou rien!')
		.addStringOption(option =>
			option.setName('cote')
				.setDescription('Pile ou Face')
				.setRequired(true)
				.addChoices(
					{ name: '🪙 Pile', value: 'pile' },
					{ name: '🛡️ Face', value: 'face' }
				))
		.addIntegerOption(option =>
			option.setName('montant')
				.setDescription('Montant d\'ELO à miser')
				.setRequired(true)
				.setMinValue(1)),

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;

		await interaction.deferReply();

		const choice = interaction.options.getString('cote');
		const amount = interaction.options.getInteger('montant');

		// 1. Verify User Account
		const userAccount = database.getAccountByDiscordId(guildId, discordUserId);
		if (!userAccount) {
			return await interaction.editReply({
				content: `❌ Tu n'as pas de compte LoL lié!\nUtilise \`/register\` ou \`/link\` d'abord.`,
				ephemeral: true
			});
		}

		// 2. Verify Balance
		const playerElo = database.getPlayerElo(guildId, userAccount.puuid);
		if (!playerElo || playerElo.elo < amount) {
			return await interaction.editReply({ // Fixed: added missing return
				content: `❌ Pas assez d'ELO! Solde: **${playerElo?.elo || 0}**`,
				ephemeral: true
			});
		}

		// 3. Initial Suspense Embed
		const embed = new EmbedBuilder()
			.setColor('#F1C40F')
			.setTitle('🪙 Coinflip')
			.setDescription(`**${interaction.user.username}** mise **${amount} ELO** sur **${choice.toUpperCase()}**!`)
			.addFields({ name: 'La pièce tourne...', value: '🔄 🔄 🔄' });

		await interaction.editReply({ embeds: [embed] });
		await new Promise(r => setTimeout(r, 2000));

		// 4. Determine Outcome (48% win rate)
		const isWin = Math.random() < 0.48;
		const resultSide = isWin ? choice : (choice === 'pile' ? 'face' : 'pile');

		// 5. Update DB
		const eloChange = isWin ? amount : -amount;
		database.updatePlayerEloDirectly(guildId, userAccount.puuid, eloChange);

		const newElo = playerElo.elo + eloChange;
		const eloRank = EloCalculator.getEloRank(newElo);

		// 6. Result Embed
		const resultEmbed = new EmbedBuilder()
			.setColor(isWin ? '#2ECC71' : '#E74C3C')
			.setTitle(isWin ? '🎉 GAGNÉ!' : '💀 PERDU!')
			.setDescription(`C'est tombé sur **${resultSide.toUpperCase()}**!`)
			.addFields(
				{ name: 'Mise', value: `${amount} ELO`, inline: true },
				{ name: 'Résultat', value: isWin ? `+${amount} ELO` : `-${amount} ELO`, inline: true },
				{ name: 'Nouveau Solde', value: `${newElo} ELO (${eloRank.name})`, inline: false }
			);

		await interaction.editReply({ embeds: [resultEmbed] });
	}
};
