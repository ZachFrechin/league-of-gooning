class EloCalculator {
  // Calculate ELO change based on match performance
  static calculateEloChange(participant, score, rankedInfo, queueId) {
    let eloChange = 0;

    // Base points for win/loss
    if (participant.win) {
      eloChange += 25; // Base win
    } else {
      eloChange -= 15; // Base loss
    }

    // Performance bonus (score 0-100 -> -10 to +10 points)
    const scoreBonus = Math.round((score - 50) / 5); // 100 score = +10, 0 score = -10
    eloChange += scoreBonus;

    // Kill bonus (diminishing returns)
    const killBonus = Math.min(participant.kills * 0.5, 10); // Max +10 for 20+ kills
    eloChange += Math.round(killBonus);

    // Vision bonus (good vision is important!)
    const visionPerMin = participant.visionScore / (participant.challenges?.gameLength || 1800 / 60);
    if (visionPerMin >= 2) eloChange += 3;
    else if (visionPerMin >= 1.5) eloChange += 2;
    else if (visionPerMin >= 1) eloChange += 1;

    // Rank multiplier (slightly affects gain/loss)
    const rankMultiplier = this.getRankMultiplier(rankedInfo, queueId);
    eloChange = Math.round(eloChange * rankMultiplier);

    // Ensure minimum change
    if (participant.win && eloChange < 5) eloChange = 5;
    if (!participant.win && eloChange > -5) eloChange = -5;

    // Cap maximum change
    eloChange = Math.max(-50, Math.min(50, eloChange));

    return eloChange;
  }

  static getRankMultiplier(rankedInfo, queueId) {
    if (!rankedInfo || rankedInfo.length === 0) return 1.0;

    const queueType = queueId === 420 ? 'RANKED_SOLO_5x5' : queueId === 440 ? 'RANKED_FLEX_SR' : null;
    if (!queueType) return 1.0;

    const rank = rankedInfo.find(r => r.queueType === queueType);
    if (!rank) return 1.0;

    // Higher ranks get slightly less ELO change (more stable)
    const tierMultipliers = {
      'IRON': 1.15,
      'BRONZE': 1.10,
      'SILVER': 1.05,
      'GOLD': 1.0,
      'PLATINUM': 0.95,
      'EMERALD': 0.93,
      'DIAMOND': 0.90,
      'MASTER': 0.88,
      'GRANDMASTER': 0.85,
      'CHALLENGER': 0.82
    };

    return tierMultipliers[rank.tier] || 1.0;
  }

  static getEloRank(elo) {
    if (elo >= 2000) return { name: '👑 Legendary', color: '#FFD700' };
    if (elo >= 1800) return { name: '⭐ Master', color: '#E91E63' };
    if (elo >= 1600) return { name: '💎 Diamond', color: '#00BCD4' };
    if (elo >= 1400) return { name: '🥇 Gold', color: '#FFC107' };
    if (elo >= 1200) return { name: '🥈 Silver', color: '#9E9E9E' };
    if (elo >= 1000) return { name: '🥉 Bronze', color: '#795548' };
    return { name: '🔩 Iron', color: '#607D8B' };
  }
}

module.exports = EloCalculator;
