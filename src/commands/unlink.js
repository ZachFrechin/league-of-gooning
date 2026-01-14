const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unlink')
		.setDescription('🔓 Délie ton compte LoL de ton Discord'),

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;

		await interaction.deferReply({ ephemeral: true });

		// Check if user has a linked account
		const linkedAccount = database.getAccountByDiscordId(guildId, discordUserId);

		if (!linkedAccount) {
			return await interaction.editReply({
				content: `❌ Tu n'as pas de compte lié à ton Discord.`
			});
		}

		// Unlink
		database.unlinkAccountFromDiscord(guildId, discordUserId);

		await interaction.editReply({
			content: `✅ Compte **${linkedAccount.game_name}#${linkedAccount.tag_line}** délié de ton Discord!\n\n⚠️ Le compte reste enregistré sur le serveur (pour le tracking).\nTu peux le re-lier avec \`/link\`.`
		});
	}
};
