const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set the channel for match notifications')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to send match notifications')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, database) {
    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    try {
      database.setNotificationChannel(guildId, channel.id);

      await interaction.editReply({
        content: `✅ Match notifications will now be sent to ${channel}!`
      });
    } catch (error) {
      console.error('Error setting up notification channel:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  }
};
