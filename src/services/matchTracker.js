const MatchFormatter = require('../utils/matchFormatter');
const EloCalculator = require('../utils/eloCalculator');

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
      let matchIds;

      try {
        matchIds = await this.riotApi.getMatchIdsByPuuid(account.puuid, 1);
      } catch (error) {
        // Check if this is a PUUID decryption error (happens when API key changes)
        if (error.message.includes('Exception decrypting')) {
          console.log(`[PUUID Refresh] Refreshing PUUID for ${account.game_name}#${account.tag_line}...`);

          try {
            // Re-fetch account data with new API key
            const accountData = await this.riotApi.getAccountByRiotId(account.game_name, account.tag_line);
            const summonerData = await this.riotApi.getSummonerByPuuid(accountData.puuid);

            // Update database with new PUUID
            this.database.updateAccountPuuid(
              account.guild_id,
              account.game_name,
              account.tag_line,
              accountData.puuid,
              summonerData.id
            );

            console.log(`[PUUID Refresh] Successfully updated PUUID for ${account.game_name}#${account.tag_line}`);

            // Retry with new PUUID
            matchIds = await this.riotApi.getMatchIdsByPuuid(accountData.puuid, 1);

            // Update account object for rest of this function
            account.puuid = accountData.puuid;
            account.summoner_id = summonerData.id;
          } catch (refreshError) {
            console.error(`[PUUID Refresh] Failed to refresh PUUID for ${account.game_name}#${account.tag_line}:`, refreshError.message);
            return;
          }
        } else {
          throw error;
        }
      }

      if (matchIds.length === 0) {
        return;
      }

      const latestMatchId = matchIds[0];

      if (account.last_match_id === latestMatchId) {
        return;
      }

      if (this.database.isMatchProcessed(account.guild_id, latestMatchId, account.puuid)) {
        return;
      }

      console.log(`New match found for ${account.game_name}#${account.tag_line}: ${latestMatchId}`);

      const matchData = await this.riotApi.getMatchDetails(latestMatchId);
      const playerStats = this.riotApi.getPlayerStats(matchData, account.puuid);

      if (playerStats.isRemake) {
        console.log(`Match ${latestMatchId} was a remake, skipping notification`);
        this.database.markMatchProcessed(account.guild_id, latestMatchId, account.puuid);
        this.database.updateLastMatchId(account.guild_id, account.puuid, latestMatchId);
        return;
      }

      const guildSettings = this.database.getGuildSettings(account.guild_id);

      if (!guildSettings || !guildSettings.notification_channel_id) {
        console.log(`No notification channel set for guild ${account.guild_id}`);
        this.database.markMatchProcessed(account.guild_id, latestMatchId, account.puuid);
        this.database.updateLastMatchId(account.guild_id, account.puuid, latestMatchId);
        return;
      }

      const channel = await this.client.channels.fetch(guildSettings.notification_channel_id);

      if (!channel) {
        console.log(`Channel ${guildSettings.notification_channel_id} not found`);
        this.database.markMatchProcessed(account.guild_id, latestMatchId, account.puuid);
        this.database.updateLastMatchId(account.guild_id, account.puuid, latestMatchId);
        return;
      }

      // Fetch rank info
      let rankedInfo = null;
      if (account.summoner_id) {
        rankedInfo = await this.riotApi.getRankedInfo(account.summoner_id);
      }

      // Calculate performance score
      const allParticipants = matchData.info.participants;
      const score = MatchFormatter.calculateScore(playerStats.participant, playerStats.gameDuration, playerStats.isRemake, allParticipants);

      // Get current player ELO data BEFORE calculating change
      const playerEloBefore = this.database.getPlayerElo(account.guild_id, account.puuid);
      const currentElo = playerEloBefore?.elo || 1000;
      const matchesPlayed = playerEloBefore?.matches_played || 0;

      // Calculate ELO change (now with matchesPlayed and currentElo)
      const eloChange = EloCalculator.calculateEloChange(
        playerStats.participant,
        score,
        rankedInfo,
        playerStats.queueId,
        matchesPlayed,
        currentElo
      );

      // Update player ELO
      this.database.updatePlayerElo(
        account.guild_id,
        account.puuid,
        eloChange,
        playerStats.participant.win,
        playerStats.participant.kills,
        score
      );

      // Get updated ELO for display
      const playerElo = this.database.getPlayerElo(account.guild_id, account.puuid);

      const message = MatchFormatter.formatMatchResult(
        matchData,
        playerStats,
        account.game_name,
        account.tag_line,
        rankedInfo,
        eloChange,
        playerElo?.elo || 1000
      );

      await channel.send(message);

      this.database.markMatchProcessed(account.guild_id, latestMatchId, account.puuid);
      this.database.updateLastMatchId(account.guild_id, account.puuid, latestMatchId);

      console.log(`Match notification sent for ${account.game_name}#${account.tag_line} (ELO: ${eloChange > 0 ? '+' : ''}${eloChange})`);
    } catch (error) {
      console.error(`Error processing match for ${account.game_name}#${account.tag_line}:`, error.message);
    }
  }
}

module.exports = MatchTracker;
