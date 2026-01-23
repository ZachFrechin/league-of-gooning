const axios = require('axios');

class RiotAPI {
  constructor(apiKey, region = 'euw1', routing = 'europe') {
    this.apiKey = apiKey;
    this.region = this.normalizeRegion(region);
    this.routing = routing;
  }

  normalizeRegion(region) {
    if (!region) return 'euw1';
    const r = region.toLowerCase();
    const mapping = {
      'euw': 'euw1',
      'na': 'na1',
      'eune': 'eun1',
      'eun': 'eun1',
      'br': 'br1',
      'tr': 'tr1',
      'jp': 'jp1',
      'oc': 'oc1',
      'lan': 'la1',
      'las': 'la2',
      'ru': 'ru'
    };
    return mapping[r] || r;
  }

  async getAccountByRiotId(gameName, tagLine) {
    try {
      const url = `https://${this.routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
      const response = await axios.get(url, {
        headers: { 'X-Riot-Token': this.apiKey }
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Account not found. Please check the Riot ID (Game Name#Tag).');
      }
      throw new Error(`Failed to fetch account: ${error.message}`);
    }
  }

  async getSummonerByPuuid(puuid, regionOverride = null) {
    try {
      const region = this.normalizeRegion(regionOverride || this.region);
      const url = `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`;
      const response = await axios.get(url, {
        headers: { 'X-Riot-Token': this.apiKey }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch summoner: ${error.message}`);
    }
  }

  async getMatchIdsByPuuid(puuid, count = 5) {
    try {
      const url = `https://${this.routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids`;
      const response = await axios.get(url, {
        params: { start: 0, count },
        headers: { 'X-Riot-Token': this.apiKey }
      });
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status || 'Unknown';
      const errorData = error.response?.data || {};
      console.error(`[Riot API Error] Status: ${statusCode}, URL: ${error.config?.url}`);
      console.error(`[Riot API Error] Response:`, JSON.stringify(errorData, null, 2));
      throw new Error(`Failed to fetch match IDs: Status ${statusCode} - ${errorData.status?.message || error.message}`);
    }
  }

  async getMatchDetails(matchId) {
    try {
      const url = `https://${this.routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
      const response = await axios.get(url, {
        headers: { 'X-Riot-Token': this.apiKey }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch match details: ${error.message}`);
    }
  }

  async getRankedInfo(summonerId, regionOverride = null) {
    const region = this.normalizeRegion(regionOverride || this.region);
    const url = `https://${region}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
    try {
      const response = await axios.get(url, {
        headers: { 'X-Riot-Token': this.apiKey }
      });
      return response.data;
    } catch (error) {
      const statusCode = error.response?.status || 'Unknown';
      throw new Error(`Failed to fetch ranked info (${region}): Status ${statusCode}`);
    }
  }

  async getChampionMasteries(puuid, regionOverride = null) {
    try {
      const region = this.normalizeRegion(regionOverride || this.region);
      const url = `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`;
      const response = await axios.get(url, {
        headers: { 'X-Riot-Token': this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch champion masteries:', error.message);
      return [];
    }
  }

  // Aliases for compatibility
  async getMatchIds(puuid, count = 20) {
    return this.getMatchIdsByPuuid(puuid, count);
  }

  async getSummonerRank(summonerId) {
    return this.getRankedInfo(summonerId);
  }

  async getLeagueEntries(summonerId) {
    return this.getRankedInfo(summonerId);
  }

  getPlayerStats(matchData, puuid) {
    const participant = matchData.info.participants.find(p => p.puuid === puuid);
    if (!participant) {
      throw new Error('Player not found in match data');
    }

    const gameDuration = matchData.info.gameDuration;
    const isRemake = gameDuration < 300;

    return {
      participant,
      gameDuration,
      isRemake,
      gameMode: matchData.info.gameMode,
      queueId: matchData.info.queueId,
      gameCreation: matchData.info.gameCreation,
      gameEndTimestamp: matchData.info.gameEndTimestamp
    };
  }
}

module.exports = RiotAPI;
