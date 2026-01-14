const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor(dbPath) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracked_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        summoner_name TEXT NOT NULL,
        summoner_id TEXT,
        game_name TEXT NOT NULL,
        tag_line TEXT NOT NULL,
        puuid TEXT NOT NULL,
        region TEXT NOT NULL,
        last_match_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guild_id, puuid)
      );

      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        notification_channel_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS processed_matches (
        match_id TEXT,
        puuid TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (match_id, puuid, guild_id)
      );

      CREATE TABLE IF NOT EXISTS player_elo (
        guild_id TEXT NOT NULL,
        puuid TEXT NOT NULL,
        elo INTEGER DEFAULT 1000,
        matches_played INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        total_kills INTEGER DEFAULT 0,
        total_score INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, puuid)
      );
    `);

    // Migration: Add summoner_id column if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE tracked_accounts ADD COLUMN summoner_id TEXT;`);
      console.log('Migration: Added summoner_id column');
    } catch (error) {
      if (!error.message.includes('duplicate column name')) {
        console.error('Migration error:', error.message);
      }
    }

    // Migration: Update processed_matches table to new schema if needed
    try {
      const tableInfo = this.db.pragma('table_info(processed_matches)');
      const hasGuildId = tableInfo.some(col => col.name === 'guild_id');

      if (!hasGuildId) {
        console.log('Migration: Updating processed_matches schema...');
        this.db.exec(`
          ALTER TABLE processed_matches RENAME TO processed_matches_old;
          
          CREATE TABLE processed_matches (
            match_id TEXT,
            puuid TEXT NOT NULL,
            guild_id TEXT NOT NULL,
            processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (match_id, puuid, guild_id)
          );
          
          DROP TABLE processed_matches_old;
        `);
        console.log('Migration: processed_matches schema updated.');
      }
    } catch (error) {
      console.error('Migration error (processed_matches):', error.message);
    }

    // Migration: Add streak and stats columns to player_elo
    const newColumns = [
      { name: 'current_streak', def: 'INTEGER DEFAULT 0' },
      { name: 'best_win_streak', def: 'INTEGER DEFAULT 0' },
      { name: 'worst_lose_streak', def: 'INTEGER DEFAULT 0' },
      { name: 'total_damage', def: 'INTEGER DEFAULT 0' },
      { name: 'total_cs', def: 'INTEGER DEFAULT 0' },
      { name: 'total_vision', def: 'INTEGER DEFAULT 0' },
      { name: 'total_deaths', def: 'INTEGER DEFAULT 0' },
      { name: 'total_assists', def: 'INTEGER DEFAULT 0' },
      { name: 'peak_elo', def: 'INTEGER DEFAULT 1000' },
      { name: 'stats_matches', def: 'INTEGER DEFAULT 0' }
    ];

    for (const col of newColumns) {
      try {
        this.db.exec(`ALTER TABLE player_elo ADD COLUMN ${col.name} ${col.def};`);
        console.log(`Migration: Added ${col.name} column to player_elo`);
      } catch (error) {
        if (!error.message.includes('duplicate column name')) {
          console.error(`Migration error (${col.name}):`, error.message);
        }
      }
    }

    // Create Indexes AFTER migrations to ensure columns exist
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tracked_accounts_guild ON tracked_accounts(guild_id);
      CREATE INDEX IF NOT EXISTS idx_tracked_accounts_puuid ON tracked_accounts(puuid);
      CREATE INDEX IF NOT EXISTS idx_processed_matches_lookup ON processed_matches(match_id, puuid, guild_id);
      CREATE INDEX IF NOT EXISTS idx_player_elo_guild ON player_elo(guild_id);
      CREATE INDEX IF NOT EXISTS idx_player_elo_elo ON player_elo(guild_id, elo DESC);
    `);
  }

  // Guild Settings
  setNotificationChannel(guildId, channelId) {
    const stmt = this.db.prepare(`
      INSERT INTO guild_settings (guild_id, notification_channel_id)
      VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET notification_channel_id = excluded.notification_channel_id
    `);
    return stmt.run(guildId, channelId);
  }

  getGuildSettings(guildId) {
    const stmt = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
    return stmt.get(guildId);
  }

  // Tracked Accounts
  addTrackedAccount(guildId, summonerName, gameName, tagLine, puuid, region, summonerId = null) {
    const stmt = this.db.prepare(`
      INSERT INTO tracked_accounts (guild_id, summoner_name, summoner_id, game_name, tag_line, puuid, region)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(guildId, summonerName, summonerId, gameName, tagLine, puuid, region);
  }

  removeTrackedAccount(guildId, gameName, tagLine) {
    const stmt = this.db.prepare(`
      DELETE FROM tracked_accounts
      WHERE guild_id = ? AND game_name = ? AND tag_line = ?
    `);
    return stmt.run(guildId, gameName, tagLine);
  }

  updateAccountPuuid(guildId, gameName, tagLine, newPuuid, newSummonerId = null) {
    const stmt = this.db.prepare(`
      UPDATE tracked_accounts
      SET puuid = ?, summoner_id = ?
      WHERE guild_id = ? AND game_name = ? AND tag_line = ?
    `);
    return stmt.run(newPuuid, newSummonerId, guildId, gameName, tagLine);
  }

  getTrackedAccounts(guildId) {
    const stmt = this.db.prepare('SELECT * FROM tracked_accounts WHERE guild_id = ?');
    return stmt.all(guildId);
  }

  getAllTrackedAccounts() {
    const stmt = this.db.prepare('SELECT * FROM tracked_accounts');
    return stmt.all();
  }

  getTrackedAccount(guildId, gameName, tagLine) {
    const stmt = this.db.prepare('SELECT * FROM tracked_accounts WHERE guild_id = ? AND game_name = ? AND tag_line = ?');
    return stmt.get(guildId, gameName, tagLine);
  }

  updateLastMatchId(guildId, puuid, matchId) {
    const stmt = this.db.prepare('UPDATE tracked_accounts SET last_match_id = ? WHERE puuid = ? AND guild_id = ?');
    return stmt.run(matchId, puuid, guildId);
  }

  // Processed Matches
  isMatchProcessed(guildId, matchId, puuid) {
    const stmt = this.db.prepare('SELECT 1 FROM processed_matches WHERE match_id = ? AND puuid = ? AND guild_id = ?');
    return stmt.get(matchId, puuid, guildId) !== undefined;
  }

  markMatchProcessed(guildId, matchId, puuid) {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO processed_matches (match_id, puuid, guild_id) VALUES (?, ?, ?)');
    return stmt.run(matchId, puuid, guildId);
  }

  // ELO System
  getPlayerElo(guildId, puuid) {
    const stmt = this.db.prepare('SELECT * FROM player_elo WHERE guild_id = ? AND puuid = ?');
    return stmt.get(guildId, puuid);
  }

  updatePlayerElo(guildId, puuid, eloChange, won, stats, score) {
    const current = this.getPlayerElo(guildId, puuid);
    const { kills = 0, deaths = 0, assists = 0, totalDamageDealtToChampions = 0, totalMinionsKilled = 0, neutralMinionsKilled = 0, visionScore = 0 } = stats;
    const totalCS = totalMinionsKilled + neutralMinionsKilled;

    if (!current) {
      // Initialize new player
      const newElo = 1000 + eloChange;
      const streak = won ? 1 : -1;
      const stmt = this.db.prepare(`
        INSERT INTO player_elo (
          guild_id, puuid, elo, matches_played, wins, losses, 
          total_kills, total_score, current_streak, best_win_streak, worst_lose_streak,
          total_damage, total_cs, total_vision, total_deaths, total_assists, peak_elo, stats_matches, updated_at
        )
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))
      `);
      return stmt.run(
        guildId, puuid, newElo,
        won ? 1 : 0, won ? 0 : 1,
        kills, score,
        streak, won ? 1 : 0, won ? 0 : -1,
        totalDamageDealtToChampions, totalCS, visionScore, deaths, assists, newElo
      );
    } else {
      // Calculate new streak
      let newStreak;
      if (won) {
        newStreak = current.current_streak >= 0 ? current.current_streak + 1 : 1;
      } else {
        newStreak = current.current_streak <= 0 ? current.current_streak - 1 : -1;
      }

      // Update best/worst streaks
      const bestWin = Math.max(current.best_win_streak || 0, newStreak);
      const worstLose = Math.min(current.worst_lose_streak || 0, newStreak);

      // Calculate new ELO and peak
      const newElo = current.elo + eloChange;
      const peakElo = Math.max(current.peak_elo || 1000, newElo);

      // Update existing player
      const stmt = this.db.prepare(`
        UPDATE player_elo
        SET elo = ?,
            matches_played = matches_played + 1,
            wins = wins + ?,
            losses = losses + ?,
            total_kills = total_kills + ?,
            total_score = total_score + ?,
            current_streak = ?,
            best_win_streak = ?,
            worst_lose_streak = ?,
            total_damage = total_damage + ?,
            total_cs = total_cs + ?,
            total_vision = total_vision + ?,
            total_deaths = total_deaths + ?,
            total_assists = total_assists + ?,
            peak_elo = ?,
            stats_matches = stats_matches + 1,
            updated_at = datetime('now')
        WHERE guild_id = ? AND puuid = ?
      `);
      return stmt.run(
        newElo,
        won ? 1 : 0, won ? 0 : 1,
        kills, score,
        newStreak, bestWin, worstLose,
        totalDamageDealtToChampions, totalCS, visionScore, deaths, assists,
        peakElo,
        guildId, puuid
      );
    }
  }

  getLeaderboard(guildId, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT
        e.*,
        t.game_name,
        t.tag_line,
        t.summoner_name
      FROM player_elo e
      JOIN tracked_accounts t ON e.puuid = t.puuid AND e.guild_id = t.guild_id
      WHERE e.guild_id = ?
      ORDER BY e.elo DESC
      LIMIT ?
    `);
    return stmt.all(guildId, limit);
  }

  // Direct ELO update (for gambling, etc.) - no match stats
  updatePlayerEloDirectly(guildId, puuid, eloChange) {
    const current = this.getPlayerElo(guildId, puuid);
    if (!current) return null;

    const newElo = Math.max(0, current.elo + eloChange); // Don't go below 0
    const peakElo = Math.max(current.peak_elo || 1000, newElo);

    const stmt = this.db.prepare(`
      UPDATE player_elo
      SET elo = ?,
          peak_elo = ?,
          updated_at = datetime('now')
      WHERE guild_id = ? AND puuid = ?
    `);
    return stmt.run(newElo, peakElo, guildId, puuid);
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
