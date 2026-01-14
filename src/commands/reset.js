const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reset')
		.setDescription('⚠️ Reset toutes les stats et ELO du serveur (ADMIN)')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addStringOption(option =>
			option.setName('confirmation')
				.setDescription('Tape "CONFIRMER" pour reset')
				.setRequired(true)),

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const confirmation = interaction.options.getString('confirmation');

		if (confirmation !== 'CONFIRMER') {
			return await interaction.reply({
				content: `❌ Reset annulé.\nPour confirmer, tape exactement \`CONFIRMER\` dans le champ confirmation.`,
				ephemeral: true
			});
		}

		await interaction.deferReply();

		try {
			// Reset all player_elo for this guild
			database.resetAllPlayerElo(guildId);

			await interaction.editReply({
				content: `✅ **Reset complet effectué!**\n\n🔄 Tous les ELO sont remis à 1000\n📊 Toutes les stats ont été réinitialisées\n🏆 Les classements repartent de zéro\n\n*Les comptes restent enregistrés, seules les stats sont reset.*`
			});
		} catch (error) {
			console.error('Error resetting stats:', error);
			await interaction.editReply({
				content: `❌ Erreur lors du reset: ${error.message}`,
				ephemeral: true
			});
		}
	}
};
