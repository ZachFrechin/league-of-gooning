const { EmbedBuilder } = require('discord.js');

class MatchFormatter {
  static DDRAGON_VERSION = '14.1.1';

  static calculateScore(stats, gameDuration, isRemake) {
    if (isRemake) {
      return 0;
    }

    let score = 0;
    const { kills, deaths, assists, win, champLevel, totalMinionsKilled, neutralMinionsKilled, visionScore, damageDealtToChampions } = stats;

    // Win/Loss (30 points)
    score += win ? 30 : 0;

    // KDA Score (25 points)
    const kda = deaths === 0 ? (kills + assists) : (kills + assists) / deaths;
    if (kda >= 5) score += 25;
    else if (kda >= 3) score += 20;
    else if (kda >= 2) score += 15;
    else if (kda >= 1) score += 10;
    else score += 5;

    // Kill Participation (15 points)
    const killParticipation = stats.challenges?.killParticipation || 0;
    score += Math.min(15, Math.floor(killParticipation * 15));

    // CS (10 points)
    const totalCS = totalMinionsKilled + neutralMinionsKilled;
    const csPerMin = totalCS / (gameDuration / 60);
    if (csPerMin >= 8) score += 10;
    else if (csPerMin >= 6) score += 7;
    else if (csPerMin >= 4) score += 5;
    else score += 2;

    // Vision Score (10 points)
    const visionPerMin = visionScore / (gameDuration / 60);
    if (visionPerMin >= 2) score += 10;
    else if (visionPerMin >= 1.5) score += 7;
    else if (visionPerMin >= 1) score += 5;
    else score += 2;

    // Damage (10 points)
    const damagePerMin = damageDealtToChampions / (gameDuration / 60);
    if (damagePerMin >= 800) score += 10;
    else if (damagePerMin >= 600) score += 7;
    else if (damagePerMin >= 400) score += 5;
    else score += 2;

    return Math.min(100, Math.round(score));
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

    // Discord doesn't render images in field values well, so just show item IDs with links
    return items.map(itemId => {
      const url = this.getItemIconUrl(itemId);
      return `[Item ${itemId}](${url})`;
    }).join(' • ');
  }

  static formatTeamComposition(participants, playerPuuid) {
    return participants
      .map(p => {
        const isPlayer = p.puuid === playerPuuid;
        const kda = `${p.kills}/${p.deaths}/${p.assists}`;
        const prefix = isPlayer ? '**➤' : '  ';
        const suffix = isPlayer ? '**' : '';
        return `${prefix} ${p.championName}: ${kda}${suffix}`;
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

  static formatMatchResult(matchData, playerStats, gameName, tagLine, rankedInfo = null) {
    const { participant, gameDuration, isRemake, gameMode, queueId } = playerStats;

    if (isRemake) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle(`🔄 Remake - ${gameName}#${tagLine}`)
        .setDescription(`**${participant.championName}** - Game was remade`)
        .setTimestamp(matchData.info.gameEndTimestamp);
      return { embeds: [embed] };
    }

    const score = this.calculateScore(participant, gameDuration, isRemake);
    const color = participant.win ? '#3498db' : '#e74c3c';
    const result = participant.win ? '🏆 VICTORY' : '💀 DEFEAT';

    const kda = participant.deaths === 0
      ? `${participant.kills} / ${participant.deaths} / ${participant.assists}`
      : `${participant.kills} / ${participant.deaths} / ${participant.assists}`;

    const kdaRatio = participant.deaths === 0
      ? (participant.kills + participant.assists).toFixed(2)
      : ((participant.kills + participant.assists) / participant.deaths).toFixed(2);

    const totalCS = participant.totalMinionsKilled + participant.neutralMinionsKilled;
    const csPerMin = (totalCS / (gameDuration / 60)).toFixed(1);
    const visionPerMin = (participant.visionScore / (gameDuration / 60)).toFixed(1);
    const damagePerMin = Math.round((participant.damageDealtToChampions || 0) / (gameDuration / 60));

    const killParticipation = participant.challenges?.killParticipation
      ? `${(participant.challenges.killParticipation * 100).toFixed(1)}%`
      : 'N/A';

    const queueType = this.getQueueType(queueId);
    const duration = this.formatDuration(gameDuration);

    const allParticipants = matchData.info.participants;
    const playerTeam = allParticipants.filter(p => p.teamId === participant.teamId);
    const enemyTeam = allParticipants.filter(p => p.teamId !== participant.teamId);

    const teamComposition = this.formatTeamComposition(playerTeam, participant.puuid);
    const enemyComposition = this.formatTeamComposition(enemyTeam, participant.puuid);

    const scoreBar = this.generateScoreBar(score);
    const championIconUrl = this.getChampionIconUrl(participant.championName);
    const rankDisplay = this.formatRank(rankedInfo, queueId);

    let description = `**${participant.championName}** • Level ${participant.champLevel} • ${duration}`;
    if (rankDisplay) {
      description += `\n${rankDisplay}`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${gameName}#${tagLine}`,
        iconURL: championIconUrl
      })
      .setTitle(`${result} - ${queueType}`)
      .setThumbnail(championIconUrl)
      .setDescription(description)
      .addFields(
        {
          name: '━━━━━━━━━━━━━━ 📊 PERFORMANCE SCORE ━━━━━━━━━━━━━━',
          value: `${scoreBar}\n**${score}/100 Points**`,
          inline: false
        },
        {
          name: '\u200b',
          value: '**═══════════ YOUR STATS ═══════════**',
          inline: false
        },
        {
          name: '⚔️ KDA',
          value: `\`\`\`\n${kda}\nRatio: ${kdaRatio}\n\`\`\``,
          inline: true
        },
        {
          name: '🎯 Kill Participation',
          value: `\`\`\`\n${killParticipation}\n\`\`\``,
          inline: true
        },
        {
          name: '🗡️ Creep Score',
          value: `\`\`\`\n${totalCS} CS\n${csPerMin}/min\n\`\`\``,
          inline: true
        },
        {
          name: '💥 Damage',
          value: `\`\`\`\n${(participant.damageDealtToChampions || 0).toLocaleString()}\n${damagePerMin}/min\n\`\`\``,
          inline: true
        },
        {
          name: '👁️ Vision Score',
          value: `\`\`\`\n${participant.visionScore || 0}\n${visionPerMin}/min\n\`\`\``,
          inline: true
        },
        {
          name: '💰 Gold',
          value: `\`\`\`\n${(participant.goldEarned || 0).toLocaleString()}\n\`\`\``,
          inline: true
        },
        {
          name: '🎒 Items',
          value: this.formatItems(participant) || 'No items',
          inline: false
        },
        {
          name: '\u200b',
          value: '**═══════════ TEAM COMPOSITIONS ═══════════**',
          inline: false
        },
        {
          name: participant.win ? '🔵 Allied Team (Victory)' : '🔵 Allied Team (Defeat)',
          value: `\`\`\`\n${teamComposition}\n\`\`\``,
          inline: true
        },
        {
          name: participant.win ? '🔴 Enemy Team (Defeat)' : '🔴 Enemy Team (Victory)',
          value: `\`\`\`\n${enemyComposition}\n\`\`\``,
          inline: true
        }
      )
      .setTimestamp(matchData.info.gameEndTimestamp)
      .setFooter({
        text: `Match ID: ${matchData.metadata.matchId}`,
        iconURL: 'https://static.wikia.nocookie.net/leagueoflegends/images/1/12/League_of_Legends_icon.png'
      });

    return { embeds: [embed] };
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
      1400: '🎯 Ultimate Spellbook'
    };
    return queueTypes[queueId] || `Queue ${queueId}`;
  }

  static formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }
}

module.exports = MatchFormatter;
