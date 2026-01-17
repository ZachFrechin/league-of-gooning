const { EmbedBuilder } = require('discord.js');
const ITEM_NAMES = require('./itemNames');

class MatchFormatter {
  static DDRAGON_VERSION = '14.1.1';

  static calculateScore(stats, gameDuration, isRemake, allParticipants = []) {
    if (isRemake) {
      return 0;
    }

    let score = 0;
    const { kills, deaths, assists, totalMinionsKilled, neutralMinionsKilled, visionScore, totalDamageDealtToChampions, goldEarned, teamPosition } = stats;
    const gameMinutes = gameDuration / 60;

    // Determine roles
    const isSupport = teamPosition === 'UTILITY';
    const isJungle = teamPosition === 'JUNGLE';

    // Helper: Get Team Stats
    let teamDamage = 0;
    let teamGold = 0;
    let teamKills = 0;

    let maxTeamDamage = 0;
    let maxTeamGold = 0;

    if (allParticipants && allParticipants.length > 0) {
      const myTeamId = stats.teamId;
      const myTeam = allParticipants.filter(p => p.teamId === myTeamId);

      teamDamage = myTeam.reduce((sum, p) => sum + (p.totalDamageDealtToChampions || 0), 0);
      teamGold = myTeam.reduce((sum, p) => sum + (p.goldEarned || 0), 0);
      teamKills = myTeam.reduce((sum, p) => sum + p.kills, 0);

      maxTeamDamage = Math.max(...myTeam.map(p => p.totalDamageDealtToChampions || 0));
      maxTeamGold = Math.max(...myTeam.map(p => p.goldEarned || 0));
    }

    if (isSupport) {
      // ... (existing support logic) ...
      // 1. VISION (Max 40 pts)
      const visionPerMin = visionScore / gameMinutes;
      let visionScoreCalc = 0;
      if (visionPerMin >= 3.0) visionScoreCalc = 40;
      else if (visionPerMin >= 2.5) visionScoreCalc = 35;
      else if (visionPerMin >= 2.2) visionScoreCalc = 30;
      else if (visionPerMin >= 2.0) visionScoreCalc = 25;
      else if (visionPerMin >= 1.75) visionScoreCalc = 20;
      else if (visionPerMin >= 1.5) visionScoreCalc = 15;
      else if (visionPerMin >= 1.25) visionScoreCalc = 10;
      else if (visionPerMin >= 1.0) visionScoreCalc = 5;
      score += visionScoreCalc;

      // 2. COMBAT (Max 50 pts)
      let kp = teamKills > 0 ? (kills + assists) / teamKills : (stats.challenges?.killParticipation || 0);
      let kpScore = 0;
      if (kp >= 0.60) kpScore = 30;
      else if (kp >= 0.50) kpScore = 25;
      else if (kp >= 0.40) kpScore = 20;
      else if (kp >= 0.30) kpScore = 15;
      else if (kp >= 0.20) kpScore = 10;
      score += kpScore;

      const survivalRatio = (assists + 1) / (deaths + 1);
      let survivalScore = 0;
      if (deaths === 0) survivalScore = 20;
      else if (survivalRatio >= 4.0) survivalScore = 20;
      else if (survivalRatio >= 3.0) survivalScore = 15;
      else if (survivalRatio >= 2.0) survivalScore = 10;
      else if (survivalRatio >= 1.0) survivalScore = 5;
      score += survivalScore;

      // 3. UTILITY (Max 10 pts)
      const dpm = (totalDamageDealtToChampions || 0) / gameMinutes;
      if (dpm >= 200) score += 10;
      else score += 5;

    } else if (isJungle) {
      // ==========================================
      // JUNGLE SCORING
      // ==========================================

      // 1. COMBAT & PRESENCE (Max 55 pts)
      // KP (35 pts) - Very influential role, boosted
      let kp = teamKills > 0 ? (kills + assists) / teamKills : (stats.challenges?.killParticipation || 0);
      let kpScore = 0;
      if (kp >= 0.65) kpScore = 35; // Boosted max
      else if (kp >= 0.55) kpScore = 28;
      else if (kp >= 0.45) kpScore = 22;
      else if (kp >= 0.35) kpScore = 16;
      else if (kp >= 0.25) kpScore = 10;
      score += kpScore;

      // KDA (20 pts)
      const kda = deaths === 0 ? (kills + assists) : (kills + assists) / deaths;
      let kdaScore = 0;
      if (deaths === 0 && (kills + assists) >= 5) kdaScore = 20;
      else if (kda >= 4.0) kdaScore = 20;
      else if (kda >= 3.0) kdaScore = 15;
      else if (kda >= 2.0) kdaScore = 10;
      else if (kda >= 1.0) kdaScore = 5;
      score += kdaScore;

      // 2. OBJECTIVES & FARM (Max 30 pts)
      // CS/min (20 pts) - Lower requirement (6.0/min for max)
      const totalCS = totalMinionsKilled + neutralMinionsKilled;
      const csPerMin = totalCS / gameMinutes;
      let csScore = 0;
      if (csPerMin >= 6.0) csScore = 20;      // 6.0/min -> Max score (easier)
      else if (csPerMin >= 5.0) csScore = 16;
      else if (csPerMin >= 4.0) csScore = 12;
      else if (csPerMin >= 3.0) csScore = 8;
      else if (csPerMin >= 2.0) csScore = 4;
      score += csScore;

      // Objective Damage / Control (10 pts)
      let objScore = 0;
      // Using generic damage or gold rank relative to team
      if (goldEarned >= maxTeamGold * 0.9) objScore = 10;
      else if (goldEarned >= maxTeamGold * 0.8) objScore = 7;
      else objScore = 5;
      score += objScore;

      // 3. DAMAGE (Max 20 pts) - Slightly reduced weight to balance KP increase
      const dpm = (totalDamageDealtToChampions || 0) / gameMinutes;
      let dmgScore = 0;
      if (dpm >= 600) dmgScore = 20;
      else if (dpm >= 450) dmgScore = 16;
      else if (dpm >= 300) dmgScore = 12;
      else if (dpm >= 150) dmgScore = 8;
      else dmgScore = 4;
      score += dmgScore;

    } else {
      // ==========================================
      // STANDARD SCORING (LANERS)
      // ==========================================

      // 1. COMBAT (Max 35 pts)
      // KDA (20 pts)
      const kda = deaths === 0 ? (kills + assists) : (kills + assists) / deaths;
      let kdaScore = 0;
      if (deaths === 0 && (kills + assists) >= 8) kdaScore = 20;
      else if (kda >= 5) kdaScore = 20;
      else if (kda >= 4) kdaScore = 17;
      else if (kda >= 3) kdaScore = 14;
      else if (kda >= 2) kdaScore = 10;
      else if (kda >= 1) kdaScore = 5;
      score += kdaScore;

      // KP (15 pts)
      let kp = teamKills > 0 ? (kills + assists) / teamKills : (stats.challenges?.killParticipation || 0);
      let kpScore = 0;
      if (kp >= 0.60) kpScore = 15;
      else if (kp >= 0.50) kpScore = 12;
      else if (kp >= 0.40) kpScore = 9;
      else if (kp >= 0.30) kpScore = 6;
      else if (kp >= 0.20) kpScore = 3;
      score += kpScore;

      // 2. DAMAGE (Max 30 pts)
      // ... (DPM score logic)
      const dpm = (totalDamageDealtToChampions || 0) / gameMinutes;
      let damageScoreAbs = 0;
      if (dpm >= 1000) damageScoreAbs = 25;
      else if (dpm >= 800) damageScoreAbs = 20;
      else if (dpm >= 600) damageScoreAbs = 15;
      else if (dpm >= 400) damageScoreAbs = 10;
      else if (dpm >= 200) damageScoreAbs = 5;

      // Relative Dmg% (reduced impact - absolute matters more)
      let damageScoreRel = 0;
      if (teamDamage > 0) {
        const dmgShare = (totalDamageDealtToChampions || 0) / teamDamage;
        if (dmgShare >= 0.35) damageScoreRel = 20; // Reduced from 25
        else if (dmgShare >= 0.30) damageScoreRel = 17;
        else if (dmgShare >= 0.25) damageScoreRel = 14;
        else if (dmgShare >= 0.20) damageScoreRel = 10;
        else if (dmgShare >= 0.15) damageScoreRel = 6;
      }

      // Favor absolute score more, blend with relative
      let finalDamageScore = Math.round(damageScoreAbs * 0.7 + damageScoreRel * 0.3);
      if (totalDamageDealtToChampions >= maxTeamDamage) finalDamageScore += 3; // Reduced bonus
      score += Math.min(30, finalDamageScore);

      // 3. FARMING & GOLD (Max 35 pts)
      const totalCS = totalMinionsKilled + neutralMinionsKilled;
      const csPerMin = totalCS / gameMinutes;
      let csScoreAbs = 0;
      if (csPerMin >= 8) csScoreAbs = 35; // Increased weight for laners
      else if (csPerMin >= 7) csScoreAbs = 30;
      else if (csPerMin >= 6) csScoreAbs = 20;
      else if (csPerMin >= 5) csScoreAbs = 15;
      else if (csPerMin >= 4) csScoreAbs = 10;
      else if (csPerMin >= 3) csScoreAbs = 5;


      // Relative Gold Bonus (reduced impact - absolute CS matters more)
      let goldScoreRel = 0;
      if (teamGold > 0) {
        const goldShare = (goldEarned || 0) / teamGold;
        if (goldShare >= 0.24) goldScoreRel = 15; // Reduced from 20
        else if (goldShare >= 0.21) goldScoreRel = 12;
        else if (goldShare >= 0.19) goldScoreRel = 9;
        else if (goldShare >= 0.17) goldScoreRel = 6;
        else if (goldShare >= 0.15) goldScoreRel = 3;
      }

      // Favor absolute CS more, blend with relative gold
      let finalFarmScore = Math.round(csScoreAbs * 0.75 + goldScoreRel * 0.25);
      if (goldEarned >= maxTeamGold && finalFarmScore < 25) {
        finalFarmScore += 3; // Reduced bonus
      }

      // STRICT RULE: If CS < 7.5, Cap Farm Score at 25.
      if (csPerMin < 7.5) {
        finalFarmScore = Math.min(25, finalFarmScore);
      }

      score += Math.min(30, finalFarmScore);

      // 4. VISION (Max 5 pts)
      const visionPerMin = visionScore / gameMinutes;
      if (visionPerMin >= 0.75) score += 5;
      else if (visionPerMin >= 0.5) score += 3;
      else if (visionPerMin >= 0.25) score += 1;
    }

    // Cap Total at 100
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Shame Score - Used ONLY for determining "Pute de la game"
   * Heavily penalizes deaths. Lower score = worse player.
   * Supports are evaluated on vision instead of kills.
   */
  static calculateShameScore(stats, gameDuration) {
    const { kills, deaths, assists, visionScore, teamPosition } = stats;
    const gameMinutes = gameDuration / 60;
    const isSupport = teamPosition === 'UTILITY';

    // Start with base score
    let shameScore = 50;

    // Deaths are HEAVILY penalized (-8 per death for everyone)
    shameScore -= deaths * 8;

    if (isSupport) {
      // SUPPORT: Judged on assists and vision, NOT kills

      // Assists are important (+2 per assist)
      shameScore += assists * 2;

      // Vision score per minute bonus
      const visionPerMin = visionScore / gameMinutes;
      if (visionPerMin >= 2.0) shameScore += 20;
      else if (visionPerMin >= 1.5) shameScore += 15;
      else if (visionPerMin >= 1.0) shameScore += 10;
      else if (visionPerMin >= 0.5) shameScore += 5;
      else shameScore -= 10; // Very low vision = bad support

    } else {
      // CARRY/OTHER: Judged on kills

      // Kills help a bit (+3 per kill)
      shameScore += kills * 3;

      // Assists help a little (+1 per assist)
      shameScore += assists * 1;
    }

    // Deaths per minute penalty (dying too fast is even worse)
    const deathsPerMin = deaths / gameMinutes;
    if (deathsPerMin >= 0.5) shameScore -= 15;       // More than 1 death per 2 min
    else if (deathsPerMin >= 0.3) shameScore -= 10;  // About 1 death per 3 min
    else if (deathsPerMin >= 0.2) shameScore -= 5;

    // KDA ratio penalty (applies to everyone)
    const kda = deaths === 0 ? (kills + assists) : (kills + assists) / deaths;
    if (kda < 0.5) shameScore -= 20;      // Very bad KDA
    else if (kda < 1) shameScore -= 10;   // Bad KDA
    else if (kda < 2) shameScore -= 5;

    return Math.max(0, shameScore);
  }

  static getChampionIconUrl(championName) {
    return `https://ddragon.leagueoflegends.com/cdn/${this.DDRAGON_VERSION}/img/champion/${championName}.png`;
  }

  static getItemIconUrl(itemId) {
    if (itemId === 0) return null;
    return `https://ddragon.leagueoflegends.com/cdn/${this.DDRAGON_VERSION}/img/item/${itemId}.png`;
  }

  static formatItems(participant) {
    const items = [
      participant.item0,
      participant.item1,
      participant.item2,
      participant.item3,
      participant.item4,
      participant.item5,
      participant.item6
    ].filter(item => item !== 0);

    if (items.length === 0) return 'No items';

    // Show item names as clickable links
    return items.map(itemId => {
      const itemName = ITEM_NAMES[itemId] || `Item ${itemId}`;
      const url = this.getItemIconUrl(itemId);
      return `[${itemName}](${url})`;
    }).join(' • ');
  }

  static formatTeamComposition(participants, playerPuuid) {
    const maxNameLength = Math.max(...participants.map(p => p.championName.length));

    return participants
      .map(p => {
        const isPlayer = p.puuid === playerPuuid;
        const kda = `${p.kills}/${p.deaths}/${p.assists}`;
        // Pad champion name for alignment
        const championName = p.championName.padEnd(maxNameLength, ' ');
        // Align KDA by adding padding before it if needed, though usually fixed width font helps
        // Let's just align the champion name column first

        const prefix = isPlayer ? '> ' : '  '; // Changed marker to be consistent length (2 chars)
        const suffix = isPlayer ? ' <' : '  '; // Added suffix for symmetry if desired, or just empty space

        // Ensure consistent spacing
        // Format: "> ChampionName   K/D/A"
        return `${prefix}${championName}   ${kda}`;
      })
      .join('\n');
  }

  static formatRank(rankedInfo, queueId) {
    if (!rankedInfo || rankedInfo.length === 0) return null;

    // For ranked solo/duo games, show RANKED_SOLO_5x5
    // For ranked flex games, show RANKED_FLEX_SR
    const queueType = queueId === 420 ? 'RANKED_SOLO_5x5' : queueId === 440 ? 'RANKED_FLEX_SR' : null;

    if (!queueType) return null;

    const rank = rankedInfo.find(r => r.queueType === queueType);
    if (!rank) return null;

    const tierEmojis = {
      'IRON': '🔩',
      'BRONZE': '🥉',
      'SILVER': '🥈',
      'GOLD': '🥇',
      'PLATINUM': '💎',
      'EMERALD': '💚',
      'DIAMOND': '💠',
      'MASTER': '👑',
      'GRANDMASTER': '⭐',
      'CHALLENGER': '🏆'
    };

    const emoji = tierEmojis[rank.tier] || '🎮';
    return `${emoji} ${rank.tier} ${rank.rank} - ${rank.leaguePoints} LP`;
  }

  static async formatMatchResult(matchData, playerStats, gameName, tagLine, rankedInfo = null, eloChange = 0, currentElo = 1000, currentStreak = 0) {
    const { participant, gameDuration, isRemake, gameMode, queueId } = playerStats;
    const allParticipants = matchData.info.participants;
    const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
    const MatchImageGenerator = require('./matchImageGenerator');

    if (isRemake) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle(`🔄 Remake - ${gameName}#${tagLine}`)
        .setDescription(`**${participant.championName}** - Game was remade`)
        .setTimestamp(matchData.info.gameEndTimestamp);
      return { embeds: [embed], files: [] };
    }

    const score = this.calculateScore(participant, gameDuration, isRemake, allParticipants);
    const color = participant.win ? '#3498db' : '#e74c3c';
    const result = participant.win ? '🏆 VICTORY' : '💀 DEFEAT';
    const queueType = this.getQueueType(queueId);

    const kda = `${participant.kills}/${participant.deaths}/${participant.assists}`;
    const kdaRatio = participant.deaths === 0
      ? (participant.kills + participant.assists).toFixed(2)
      : ((participant.kills + participant.assists) / participant.deaths).toFixed(2);

    const totalCS = participant.totalMinionsKilled + participant.neutralMinionsKilled;
    const csPerMin = (totalCS / (gameDuration / 60)).toFixed(1);
    const visionPerMin = (participant.visionScore / (gameDuration / 60)).toFixed(1);
    const damagePerMin = Math.round((participant.totalDamageDealtToChampions || 0) / (gameDuration / 60));

    const killParticipation = participant.challenges?.killParticipation
      ? `${(participant.challenges.killParticipation * 100).toFixed(1)}%`
      : 'N/A';

    const championIconUrl = this.getChampionIconUrl(participant.championName);

    // Get teams for image
    const playerTeam = allParticipants.filter(p => p.teamId === participant.teamId);
    const enemyTeam = allParticipants.filter(p => p.teamId !== participant.teamId);

    // Generate image
    let files = [];
    try {
      const imageBuffer = await MatchImageGenerator.generateFullMatchImage(
        participant, participant.win, score, playerTeam, enemyTeam
      );
      files.push(new AttachmentBuilder(imageBuffer, { name: 'match-summary.png' }));
    } catch (err) {
      console.error('[MatchFormatter] Failed to generate image:', err.message);
    }

    // Build description with riot rank, our ELO, and streak
    const EloCalculator = require('./eloCalculator');
    const eloRank = EloCalculator.getEloRank(currentElo);
    const eloChangeDisplay = eloChange > 0 ? `+${eloChange}` : `${eloChange}`;

    let descriptionLines = [];

    // Riot rank display
    if (rankedInfo && rankedInfo.tier) {
      const riotRankText = `🎖️ **${rankedInfo.tier} ${rankedInfo.rank}** - ${rankedInfo.leaguePoints} LP`;
      descriptionLines.push(riotRankText);
    }

    // Our ELO system
    descriptionLines.push(`${eloRank.name}: **${currentElo} ELO** (${eloChangeDisplay})`);

    // Streak message
    const streakMessage = this.getStreakMessage(currentStreak);
    if (streakMessage) {
      descriptionLines.push('');
      descriptionLines.push(streakMessage);
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${gameName}#${tagLine}`,
        iconURL: championIconUrl
      })
      .setTitle(`${result} - ${queueType}`)
      .setDescription(descriptionLines.join('\n'));

    // Big score at top
    embed.addFields({
      name: '📊 PERFORMANCE',
      value: `# ${score}`,
      inline: false
    });

    // Stats boxes (same size with 2 lines each)
    embed.addFields(
      {
        name: '⚔️ KDA',
        value: `\`\`\`\n${kda}\nRatio: ${kdaRatio}\n\`\`\``,
        inline: true
      },
      {
        name: '🎯 Kill Part.',
        value: `\`\`\`\n${killParticipation}\n \n\`\`\``,
        inline: true
      },
      {
        name: '💥 Damage',
        value: `\`\`\`\n${(participant.totalDamageDealtToChampions || 0).toLocaleString()}\n${damagePerMin}/min\n\`\`\``,
        inline: true
      },
      {
        name: '🗡️ Farm',
        value: `\`\`\`\n${totalCS} CS\n${csPerMin}/min\n\`\`\``,
        inline: true
      },
      {
        name: '👁️ Vision',
        value: `\`\`\`\n${participant.visionScore}\n${visionPerMin}/min\n\`\`\``,
        inline: true
      },
      {
        name: '💰 Gold',
        value: `\`\`\`\n${(participant.goldEarned || 0).toLocaleString()}\n \n\`\`\``,
        inline: true
      }
    );

    // Image
    if (files.length > 0) {
      embed.setImage('attachment://match-summary.png');
    }

    // Worst players ("Pute de la game")
    const scoredParticipants = allParticipants.map(p => {
      const shameScore = this.calculateShameScore(p, gameDuration);
      return { ...p, shameScore };
    });

    // Feature "Pute de la game" (Worst Player of the match)
    // Find absolute worst player across both teams based on shame score
    const worstPlayer = scoredParticipants.reduce((min, p) => p.shameScore < min.shameScore ? p : min, scoredParticipants[0]);

    if (worstPlayer) {
      embed.addFields(
        {
          name: '🤡 Pute de la Game',
          value: `\`\`\`\n${worstPlayer.championName} (${worstPlayer.win ? 'Win' : 'Loss'})\n${worstPlayer.kills}/${worstPlayer.deaths}/${worstPlayer.assists}\n\`\`\``,
          inline: false // Full width for prominence
        }
      );
    }

    embed
      .setTimestamp(matchData.info.gameEndTimestamp)
      .setFooter({
        text: `Match ID: ${matchData.metadata.matchId}`
      });

    return { embeds: [embed], files };
  }

  static generateScoreBar(score) {
    const totalBars = 20;
    const filledBars = Math.round((score / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    let color;
    if (score >= 80) color = '🟩';
    else if (score >= 60) color = '🟨';
    else if (score >= 40) color = '🟧';
    else color = '🟥';

    const bar = color.repeat(filledBars) + '⬜'.repeat(emptyBars);
    return bar;
  }

  static getQueueType(queueId) {
    const queueTypes = {
      420: '⚔️ Ranked Solo/Duo',
      440: '👥 Ranked Flex',
      450: '🎲 ARAM',
      400: '🎯 Normal Draft',
      430: '🎮 Normal Blind',
      700: '⚡ Clash',
      900: '🌟 ARURF',
      1020: '🔥 One for All',
      1300: '🏛️ Nexus Blitz',
      1400: '🎯 Ultimate Spellbook',
      1700: '🏟️ Arena 2v2v2v2',
      1710: '🏟️ Arena Ranked',
      1900: '🌙 Pick URF',
      2000: '🎭 Tutorial',
      2010: '🎭 Tutorial',
      2020: '🎭 Tutorial'
    };
    return queueTypes[queueId] || `Queue ${queueId}`;
  }

  static formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  /**
   * Generate a streak message for win/lose streaks of 3+
   */
  static getStreakMessage(streak) {
    if (streak >= 5) {
      const messages = [
        `🔥 **${streak} VICTOIRES D'AFFILÉE!** On fire! 🔥`,
        `🚀 **WIN STREAK: ${streak}** - INARRÊTABLE!`,
        `⭐ **${streak} wins** - Tu fais peur là!`,
        `👑 **${streak} victoires** - Le roi de la Rift!`
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    } else if (streak >= 3) {
      const messages = [
        `🔥 **${streak} victoires d'affilée!**`,
        `📈 **Win streak: ${streak}** - Continue!`,
        `✨ **${streak} wins** - Ça roule!`
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    } else if (streak <= -5) {
      const messages = [
        `💀 **${Math.abs(streak)} DÉFAITES D'AFFILÉE** - Skill issue confirmé`,
        `🤡 **LOSE STREAK: ${Math.abs(streak)}** - C'est l'heure d'aller dehors`,
        `📉 **${Math.abs(streak)} losses** - Désinstalle le jeu stp`,
        `🚽 **${Math.abs(streak)} défaites** - Tu grief ou quoi?`,
        `😭 **${Math.abs(streak)} loses** - Même ton ADC carry mieux`
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    } else if (streak <= -3) {
      const messages = [
        `📉 **${Math.abs(streak)} défaites d'affilée...** Ça arrive!`,
        `💀 **Lose streak: ${Math.abs(streak)}** - Prends une pause?`,
        `😬 **${Math.abs(streak)} losses** - ARAM time?`
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }
    return null;
  }
}

module.exports = MatchFormatter;
