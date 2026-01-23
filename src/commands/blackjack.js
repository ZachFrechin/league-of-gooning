const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const EloCalculator = require('../utils/eloCalculator');

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
	const deck = [];
	for (const suit of SUITS) {
		for (const value of VALUES) {
			let points = parseInt(value);
			if (['J', 'Q', 'K'].includes(value)) points = 10;
			if (value === 'A') points = 11;
			deck.push({ suit, value, points });
		}
	}
	return deck.sort(() => Math.random() - 0.5); // Shuffle
}

function calculateHand(hand) {
	let score = hand.reduce((a, b) => a + b.points, 0);
	let aces = hand.filter(c => c.value === 'A').length;
	while (score > 21 && aces > 0) {
		score -= 10;
		aces--;
	}
	return score;
}

function formatHand(hand, hideSecond = false) {
	if (hideSecond) {
		return `${hand[0].value}${hand[0].suit} | 🎴`;
	}
	return hand.map(c => `${c.value}${c.suit}`).join(' | ');
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('blackjack')
		.setDescription('🃏 Blackjack - Bats le croupier pour doubler!')
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

		// Initial Game State
		const deck = createDeck();
		const playerHand = [deck.pop(), deck.pop()];
		const dealerHand = [deck.pop(), deck.pop()];
		let isGameOver = false;

		// Check Natural Blackjack
		const playerVal = calculateHand(playerHand);
		const dealerVal = calculateHand(dealerHand);

		// Immediate Blackjack check
		if (playerVal === 21) {
			isGameOver = true;
			// Immediate win (unless dealer also has 21 - simplified to Win 2.5x for player Blackjack typically, or Push if dealer also has it)
			// Let's implement: Player Blackjack (Natural) pays 3:2 (2.5x total), unless Dealer also has 21 (Push)
			// But typically simpler: Instant win x2.5
		}

		const embed = new EmbedBuilder()
			.setColor('#2C3E50')
			.setTitle('🃏 Blackjack')
			.setDescription(`Mise: **${amount} ELO**`)
			.addFields(
				{ name: `👤 ${interaction.user.username} (${playerVal})`, value: formatHand(playerHand), inline: true },
				{ name: `🤵 Croupier (${isGameOver ? dealerVal : '?'})`, value: formatHand(dealerHand, !isGameOver), inline: true }
			);

		if (isGameOver) {
			// Handle Natural Blackjack immediately
			if (dealerVal === 21) {
				// Push
				await interaction.reply({ embeds: [embed.setColor('#95A5A6').setFooter({ text: 'Egalité (Blackjack vs Blackjack) - Mise remboursée' })] });
				return;
			} else {
				// Win 2.5x
				const profit = Math.ceil(amount * 1.5);
				database.updatePlayerEloDirectly(guildId, userAccount.puuid, profit);
				await interaction.reply({ embeds: [embed.setColor('#F1C40F').setFooter({ text: `BLACKJACK! Tu gagnes +${profit} ELO!` })] });
				return;
			}
		}

		// Buttons
		const row = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder().setCustomId('hit').setLabel('Tirer (Hit)').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
				new ButtonBuilder().setCustomId('stand').setLabel('Rester (Stand)').setStyle(ButtonStyle.Success).setEmoji('🛑'),
			);

		const response = await interaction.reply({ embeds: [embed], components: [row] });

		// Collector
		const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

		collector.on('collect', async i => {
			if (i.user.id !== interaction.user.id) {
				return i.reply({ content: 'Pas ta partie!', ephemeral: true });
			}

			if (i.customId === 'hit') {
				playerHand.push(deck.pop());
				const newVal = calculateHand(playerHand);

				// Update Embed
				embed.setFields(
					{ name: `👤 ${interaction.user.username} (${newVal})`, value: formatHand(playerHand), inline: true },
					{ name: `🤵 Croupier (?)`, value: formatHand(dealerHand, true), inline: true }
				);

				if (newVal > 21) {
					// BUST
					collector.stop('bust');
				} else if (newVal === 21) {
					// Auto stand on 21 (usually good UX)
					collector.stop('stand');
				} else {
					await i.update({ embeds: [embed] });
				}
			} else if (i.customId === 'stand') {
				collector.stop('stand');
			}
		});

		collector.on('end', async (collected, reason) => {
			// Dealer Turn logic
			let pScore = calculateHand(playerHand);
			let dScore = calculateHand(dealerHand);
			let profit = 0;
			let resultText = '';
			let resultColor = '#2C3E50';

			if (reason === 'bust') {
				resultText = `💥 BUST! Tu as dépassé 21. Tu perds **${amount} ELO**.`;
				resultColor = '#E74C3C';
				profit = -amount;
				// Reveal dealer card anyway
				embed.setFields(
					{ name: `👤 ${interaction.user.username} (${pScore})`, value: formatHand(playerHand), inline: true },
					{ name: `🤵 Croupier (${dScore})`, value: formatHand(dealerHand), inline: true }
				);
			} else {
				// Dealer plays
				// Reveal first
				await interaction.editReply({ components: [] }); // Remove buttons

				while (dScore < 17) {
					dealerHand.push(deck.pop());
					dScore = calculateHand(dealerHand);
				}

				// Final comparison
				if (dScore > 21) {
					resultText = `🎉 Le Croupier BUST! Tu gagnes **+${amount} ELO**!`;
					resultColor = '#2ECC71';
					profit = amount;
				} else if (pScore > dScore) {
					resultText = `🎉 Tu bats le Croupier (${pScore} vs ${dScore}). Tu gagnes **+${amount} ELO**!`;
					resultColor = '#2ECC71';
					profit = amount;
				} else if (pScore === dScore) {
					resultText = `⚖️ Egalité (${pScore} vs ${dScore}). Mise remboursée.`;
					resultColor = '#95A5A6';
					profit = 0;
				} else {
					resultText = `💀 Le Croupier gagne (${dScore} vs ${pScore}). Tu perds **${amount} ELO**.`;
					resultColor = '#E74C3C';
					profit = -amount;
				}

				embed.setFields(
					{ name: `👤 ${interaction.user.username} (${pScore})`, value: formatHand(playerHand), inline: true },
					{ name: `🤵 Croupier (${dScore})`, value: formatHand(dealerHand), inline: true }
				);
			}

			// Execute DB Update
			if (profit !== 0) {
				database.updatePlayerEloDirectly(guildId, userAccount.puuid, profit);
			}

			const finalElo = playerElo.elo + profit;
			embed.setColor(resultColor)
				.setFooter({ text: `${resultText}\nNouveau solde: ${finalElo}` });

			await interaction.editReply({ embeds: [embed], components: [] });
		});
	}
};
