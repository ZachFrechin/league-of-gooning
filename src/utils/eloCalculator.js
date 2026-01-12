class EloCalculator {
  /**
   * Calculate ELO change based on 3 factors:
   * 1. Score (performance)
   * 2. Match Count (placement phase)
   * 3. Current ELO (rank pressure)
   */
  static calculateEloChange(participant, score, rankedInfo, queueId, matchesPlayed = 0, currentElo = 1000) {
    const isWin = participant.win;

    // Base values
    const baseWin = 25;
    const baseLoss = -20;

    // === FACTOR 1: Score Multiplier ===
    // Score 100 = 2x, Score 50 = 1x, Score 0 = 0.4x (capped)
    const scoreMultiplier = Math.max(0.4, score / 50);

    // === FACTOR 2: Match Count Factor (Placement Phase) ===
    const { gainFactor: matchGain, lossFactor: matchLoss } = this.getMatchCountFactors(matchesPlayed);

    // === FACTOR 3: ELO Rank Factor ===
    const { gainFactor: eloGain, lossFactor: eloLoss } = this.getEloFactors(currentElo);

    let eloChange;
    if (isWin) {
      // High score = more gains
      eloChange = baseWin * scoreMultiplier * matchGain * eloGain;
    } else {
      // High score = less losses (divide by scoreMultiplier)
      eloChange = baseLoss / scoreMultiplier * matchLoss * eloLoss;
    }

    // Round and cap
    eloChange = Math.round(eloChange);

    // Minimum change to always feel impactful
    if (isWin && eloChange < 5) eloChange = 5;
    if (!isWin && eloChange > -5) eloChange = -5;

    // Cap maximum change
    eloChange = Math.max(-100, Math.min(100, eloChange));

    return eloChange;
  }

  /**
   * Match count affects volatility (placement phase)
   * Early games: Big gains, small losses (easy climb)
   * Many games: Smaller gains, bigger losses (stability/pressure)
   */
  static getMatchCountFactors(matchesPlayed) {
    if (matchesPlayed <= 10) {
      return { gainFactor: 1.50, lossFactor: 0.50 };
    } else if (matchesPlayed <= 30) {
      return { gainFactor: 1.20, lossFactor: 0.80 };
    } else if (matchesPlayed <= 50) {
      return { gainFactor: 1.00, lossFactor: 1.00 };
    } else if (matchesPlayed <= 100) {
      return { gainFactor: 0.90, lossFactor: 1.20 };
    } else {
      return { gainFactor: 0.80, lossFactor: 1.50 };
    }
  }

  /**
   * ELO rank affects difficulty to climb/maintain
   * High ELO: Less gains, more losses
   */
  static getEloFactors(currentElo) {
    if (currentElo < 1200) {
      return { gainFactor: 1.00, lossFactor: 0.80 };
    } else if (currentElo < 1400) {
      return { gainFactor: 0.95, lossFactor: 1.00 };
    } else if (currentElo < 1600) {
      return { gainFactor: 0.85, lossFactor: 1.10 };
    } else if (currentElo < 1800) {
      return { gainFactor: 0.75, lossFactor: 1.20 };
    } else {
      return { gainFactor: 0.65, lossFactor: 1.40 };
    }
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
