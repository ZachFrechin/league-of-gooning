const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('bet')
		.setDescription('💸 Parie sur le prochain match d\'un joueur')
		.addStringOption(option =>
			option.setName('joueur')
				.setDescription('Nom du joueur sur qui parier (ex: Faker)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('tag')
				.setDescription('Tag du joueur (ex: KR1)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('prediction')
				.setDescription('Ton pari : Victoire ou Défaite ?')
				.setRequired(true)
				.addChoices(
					{ name: '🏆 Victoire', value: 'win' },
					{ name: '💀 Défaite', value: 'lose' }
				))
		.addIntegerOption(option =>
			option.setName('montant')
				.setDescription('Montant d\'ELO à miser')
				.setRequired(true)
				.setMinValue(10)),

	async execute(interaction, database, riotApi) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;
		const targetName = interaction.options.getString('joueur');
		const targetTag = interaction.options.getString('tag');
		const prediction = interaction.options.getString('prediction');
		const amount = interaction.options.getInteger('montant');

		await interaction.deferReply();

		// 1. Validate Bettor
		const bettorAccount = database.getAccountByDiscordId(guildId, discordUserId);
		if (!bettorAccount) {
			return await interaction.editReply({
				content: `❌ Tu dois lier ton compte LoL pour parier! (Utilise \`/register\` ou \`/link\`)`
			});
		}

		// 2. Validate Target
		// We check if target is tracked in our DB first (easier) or fetch from Riot API
		// Bets only work on tracked players ideally, otherwise we can't resolve them automatically easily.
		// Let's enforce target must be tracked in this server.
		const targetAccount = database.getTrackedAccount(guildId, targetName, targetTag);
		if (!targetAccount) {
			return await interaction.editReply({
				content: `❌ Le joueur **${targetName}#${targetTag}** n'est pas tracké sur ce serveur.\nJe ne peux prendre les paris que sur les joueurs enregistrés.`
			});
		}

		// 3. Self-bet check
		if (targetAccount.puuid === bettorAccount.puuid) {
			return await interaction.editReply({
				content: `❌ Tu ne peux pas parier sur toi-même! (Conflit d'intérêt 👮)`
			});
		}

		// 4. Validate Balance
		const playerElo = database.getPlayerElo(guildId, bettorAccount.puuid);
		if (!playerElo || playerElo.elo < amount) {
			return await interaction.editReply({
				content: `❌ Pas assez d'ELO! Solde: **${playerElo?.elo || 0}**`
			});
		}

		// 5. Place Bet
		// Deduct ELO immediately (Escrow)
		database.updatePlayerEloDirectly(guildId, bettorAccount.puuid, -amount);

		// Store Bet
		database.createBet(guildId, bettorAccount.puuid, targetAccount.puuid, amount, prediction);

		const embed = new EmbedBuilder()
			.setColor('#9B59B6')
			.setTitle('💸 Pari Enregistré!')
			.setDescription(`**${interaction.user.username}** a parié **${amount} ELO** sur **${targetName}**!`)
			.addFields(
				{ name: 'Cible', value: `${targetName}#${targetTag}`, inline: true },
				{ name: 'Prédiction', value: prediction === 'win' ? '🏆 Victoire' : '💀 Défaite', inline: true },
				{ name: 'Gain Potentiel', value: `${Math.floor(amount * 1.8)} ELO (x1.8)`, inline: true }
			)
			.setFooter({ text: `Le pari sera résolu à la fin du prochain match tracké de ${targetName}.` });

		await interaction.editReply({ embeds: [embed] });
	}
};
