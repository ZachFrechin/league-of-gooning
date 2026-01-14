const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('link')
		.setDescription('🔗 Lie un compte LoL existant à ton Discord')
		.addStringOption(option =>
			option.setName('gamename')
				.setDescription('Nom du joueur (sans le tag)')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('tag')
				.setDescription('Tag Line (ex: EUW)')
				.setRequired(true)),

	async execute(interaction, database) {
		const guildId = interaction.guildId;
		const discordUserId = interaction.user.id;
		const gameName = interaction.options.getString('gamename');
		const tagLine = interaction.options.getString('tag');

		await interaction.deferReply({ ephemeral: true });

		// Check if account exists
		const account = database.getTrackedAccount(guildId, gameName, tagLine);

		if (!account) {
			return await interaction.editReply({
				content: `❌ Le compte **${gameName}#${tagLine}** n'est pas enregistré sur ce serveur.\nUtilise \`/register\` pour l'ajouter.`
			});
		}

		// Check if account is already linked to someone else
		if (account.discord_user_id && account.discord_user_id !== discordUserId) {
			return await interaction.editReply({
				content: `❌ Ce compte est déjà lié à <@${account.discord_user_id}>!`
			});
		}

		// Check if already linked to this user
		if (account.discord_user_id === discordUserId) {
			return await interaction.editReply({
				content: `✅ Ce compte est déjà lié à toi!`
			});
		}

		// Check if this Discord user already has a linked account
		const existingLink = database.getAccountByDiscordId(guildId, discordUserId);
		if (existingLink) {
			return await interaction.editReply({
				content: `❌ Tu as déjà un compte lié: **${existingLink.game_name}#${existingLink.tag_line}**\nUtilise \`/unlink\` d'abord si tu veux changer.`
			});
		}

		// Link the account
		database.linkAccountToDiscord(guildId, account.puuid, discordUserId);

		await interaction.editReply({
			content: `✅ Compte **${gameName}#${tagLine}** lié à ton Discord!\n\n🎰 Tu peux maintenant utiliser \`/gamble\` sans spécifier ton compte.`
		});
	}
};
