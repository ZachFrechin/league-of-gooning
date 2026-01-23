const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EloCalculator = require('../utils/eloCalculator');

const SYMBOLS = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
const PAYOUTS = {
	'7️⃣-7️⃣-7️⃣': 50,
	'💎-💎-💎': 20,
	'🍇-🍇-🍇': 10,
	'🍋-🍋-🍋': 5,
	'🍒-🍒-🍒': 3,
	'🍒-🍒': 1 // Any 2 cherries (simplified check logic needed)
};

// Probability weights (lower index = more common)
// 0:🍒, 1:🍋, 2:🍇, 3:💎, 4:7️⃣
// Weights: Cherries common, 7s very rare
const WEIGHTS = [45, 25, 15, 10, 5];

function spinReel() {
	const totalWeight = WEIGHTS.reduce((a, b) => a + b, 0);
	let random = Math.random() * totalWeight;
	for (let i = 0; i < WEIGHTS.length; i++) {
		if (random < WEIGHTS[i]) return SYMBOLS[i];
		random -= WEIGHTS[i];
	}
	return SYMBOLS[0];
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('slots')
		.setDescription('🎰 Machine à sous - Tente le Jackpot (x50)!')
		.addIntegerOption(option =>
			option.setName('montant')
				.setDescription('Mise ELO')
				.setRequired(true)
				.setMinValue(1)),

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;
		const amount = interaction.options.getInteger('montant');

		// Validation
		const userAccount = database.getAccountByDiscordId(guildId, discordUserId);
		if (!userAccount) return interaction.reply({ content: '❌ Compte non lié. Utilise `/link` ou `/register`.', ephemeral: true });

		const playerElo = database.getPlayerElo(guildId, userAccount.puuid);
		if (!playerElo || playerElo.elo < amount) return interaction.reply({ content: `❌ Pas assez d'ELO! (${playerElo?.elo || 0})`, ephemeral: true });

		await interaction.deferReply();

		// 1. Animation Logic
		const embed = new EmbedBuilder()
			.setColor('#9B59B6')
			.setTitle('🎰 SLOTS')
			.setDescription('La machine tourne...')
			.addFields({ name: 'Result', value: '❓ | ❓ | ❓' });

		const msg = await interaction.editReply({ embeds: [embed] });

		// Simulate spinning
		const frames = [
			'🍒 | 🍋 | 🍇',
			'💎 | 7️⃣ | 🍒',
			'🍇 | 💎 | 🍋'
		];

		for (const frame of frames) {
			embed.setFields({ name: 'Result', value: frame });
			await interaction.editReply({ embeds: [embed] });
			await new Promise(r => setTimeout(r, 600));
		}

		// 2. Final Result
		const r1 = spinReel();
		const r2 = spinReel();
		const r3 = spinReel();
		const resultString = `${r1} | ${r2} | ${r3}`;
		const combination = `${r1}-${r2}-${r3}`;

		// 3. Calculate Payout
		let multiplier = 0;

		// Exact matches
		if (PAYOUTS[combination]) {
			multiplier = PAYOUTS[combination];
		} else {
			// Partial matches (2 cherries)
			// Rules: Must contain at least 2 cherries anywhere? Or specifically Left-Right?
			// Standard slots: Left to Right.
			// Let's do: if it contains 2 cherries irrespective of order for 1x refund (friendly)
			const cherries = [r1, r2, r3].filter(s => s === '🍒').length;
			if (cherries === 2) multiplier = 1; // Refund
		}

		const payout = Math.floor(amount * multiplier);
		const profit = payout - amount;

		// 4. Update DB
		database.updatePlayerEloDirectly(guildId, userAccount.puuid, profit);
		const newElo = playerElo.elo + profit;

		// 5. Final Embed
		embed.setFields({ name: 'Result', value: `**${resultString}**` });
		if (profit > 0) {
			embed.setColor('#2ECC71')
				.setDescription(`🎉 **JACKPOT!** Tu as gagné **${payout} ELO** (x${multiplier})!`)
				.setFooter({ text: `Nouveau solde: ${newElo}` });
		} else if (multiplier === 1) {
			embed.setColor('#3498DB')
				.setDescription(`🍒 **REFUND!** Tu récupères ta mise.`)
				.setFooter({ text: `Nouveau solde: ${newElo}` });
		} else {
			embed.setColor('#E74C3C')
				.setDescription(`❌ **PERDU!** Meilleure chance la prochaine fois.`)
				.setFooter({ text: `Nouveau solde: ${newElo}` });
		}

		await interaction.editReply({ embeds: [embed] });
	}
};
