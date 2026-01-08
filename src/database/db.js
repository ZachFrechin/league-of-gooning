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
        match_id TEXT PRIMARY KEY,
        puuid TEXT NOT NULL,
        processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tracked_accounts_guild ON tracked_accounts(guild_id);
      CREATE INDEX IF NOT EXISTS idx_tracked_accounts_puuid ON tracked_accounts(puuid);
      CREATE INDEX IF NOT EXISTS idx_processed_matches_puuid ON processed_matches(puuid);
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

  getTrackedAccounts(guildId) {
    const stmt = this.db.prepare('SELECT * FROM tracked_accounts WHERE guild_id = ?');
    return stmt.all(guildId);
  }

  getAllTrackedAccounts() {
    const stmt = this.db.prepare('SELECT * FROM tracked_accounts');
    return stmt.all();
  }

  updateLastMatchId(puuid, matchId) {
    const stmt = this.db.prepare('UPDATE tracked_accounts SET last_match_id = ? WHERE puuid = ?');
    return stmt.run(matchId, puuid);
  }

  // Processed Matches
  isMatchProcessed(matchId, puuid) {
    const stmt = this.db.prepare('SELECT 1 FROM processed_matches WHERE match_id = ? AND puuid = ?');
    return stmt.get(matchId, puuid) !== undefined;
  }

  markMatchProcessed(matchId, puuid) {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO processed_matches (match_id, puuid) VALUES (?, ?)');
    return stmt.run(matchId, puuid);
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
