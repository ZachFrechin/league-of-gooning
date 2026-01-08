const MatchFormatter = require('../utils/matchFormatter');

class MatchTracker {
  constructor(client, database, riotApi, checkInterval) {
    this.client = client;
    this.database = database;
    this.riotApi = riotApi;
    this.checkInterval = checkInterval;
    this.intervalId = null;
  }

  start() {
    if (this.intervalId) {
      console.log('Match tracker is already running');
      return;
    }

    console.log(`Starting match tracker with interval: ${this.checkInterval}ms`);
    this.checkMatches();
    this.intervalId = setInterval(() => this.checkMatches(), this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Match tracker stopped');
    }
  }

  async checkMatches() {
    try {
      const trackedAccounts = this.database.getAllTrackedAccounts();

      if (trackedAccounts.length === 0) {
        return;
      }

      console.log(`Checking matches for ${trackedAccounts.length} tracked accounts...`);

      for (const account of trackedAccounts) {
        try {
          await this.checkAccountMatches(account);
        } catch (error) {
          console.error(`Error checking matches for ${account.game_name}#${account.tag_line}:`, error.message);
        }
      }
    } catch (error) {
      console.error('Error in checkMatches:', error);
    }
  }

  async checkAccountMatches(account) {
    try {
      const matchIds = await this.riotApi.getMatchIdsByPuuid(account.puuid, 1);

      if (matchIds.length === 0) {
        return;
      }

      const latestMatchId = matchIds[0];

      if (account.last_match_id === latestMatchId) {
        return;
      }

      if (this.database.isMatchProcessed(latestMatchId, account.puuid)) {
        return;
      }

      console.log(`New match found for ${account.game_name}#${account.tag_line}: ${latestMatchId}`);

      const matchData = await this.riotApi.getMatchDetails(latestMatchId);
      const playerStats = this.riotApi.getPlayerStats(matchData, account.puuid);

      if (playerStats.isRemake) {
        console.log(`Match ${latestMatchId} was a remake, skipping notification`);
        this.database.markMatchProcessed(latestMatchId, account.puuid);
        this.database.updateLastMatchId(account.puuid, latestMatchId);
        return;
      }

      const guildSettings = this.database.getGuildSettings(account.guild_id);

      if (!guildSettings || !guildSettings.notification_channel_id) {
        console.log(`No notification channel set for guild ${account.guild_id}`);
        this.database.markMatchProcessed(latestMatchId, account.puuid);
        this.database.updateLastMatchId(account.puuid, latestMatchId);
        return;
      }

      const channel = await this.client.channels.fetch(guildSettings.notification_channel_id);

      if (!channel) {
        console.log(`Channel ${guildSettings.notification_channel_id} not found`);
        this.database.markMatchProcessed(latestMatchId, account.puuid);
        this.database.updateLastMatchId(account.puuid, latestMatchId);
        return;
      }

      // Fetch rank info
      let rankedInfo = null;
      if (account.summoner_id) {
        rankedInfo = await this.riotApi.getRankedInfo(account.summoner_id);
      }

      const message = MatchFormatter.formatMatchResult(
        matchData,
        playerStats,
        account.game_name,
        account.tag_line,
        rankedInfo
      );

      await channel.send(message);

      this.database.markMatchProcessed(latestMatchId, account.puuid);
      this.database.updateLastMatchId(account.puuid, latestMatchId);

      console.log(`Match notification sent for ${account.game_name}#${account.tag_line}`);
    } catch (error) {
      console.error(`Error processing match for ${account.game_name}#${account.tag_line}:`, error.message);
    }
  }
}

module.exports = MatchTracker;
