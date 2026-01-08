# Bot Features Summary

## 🎮 Core Functionality

### Automatic Match Tracking
- Monitors registered League of Legends accounts every 2 minutes (configurable)
- Detects newly completed matches automatically
- Posts rich notifications to configured Discord channel
- Prevents duplicate notifications using SQLite database
- Handles remakes gracefully (skips notification)

### Multi-Server Support
- Each Discord server has independent settings
- Separate tracked account lists per server
- Individual notification channels per server
- Scalable to unlimited servers and accounts

## 💎 Visual Enhancements

### Champion Representation
- **Champion Icon as Avatar**: Profile picture shows the played champion
- **Large Thumbnail**: Champion portrait prominently displayed
- **Official Assets**: All images from Riot Data Dragon CDN

### Item Display
- **Visual Item Icons**: Shows all 6 items + trinket with actual game images
- **Smart Filtering**: Only displays purchased items (hides empty slots)
- **Inline Layout**: Items displayed horizontally like in-game inventory

### Color-Coded Results
- **Victory**: Beautiful blue (#3498db) embed
- **Defeat**: Striking red (#e74c3c) embed
- **Remake**: Neutral gray (#95A5A6) embed

### Performance Score Bar
Visual 20-segment progress bar with dynamic colors:
- 🟩 **80-100**: Excellent performance (Green)
- 🟨 **60-79**: Good performance (Yellow)
- 🟧 **40-59**: Average performance (Orange)
- 🟥 **0-39**: Poor performance (Red)

## 📊 Statistics Display

### Player Stats (Prominently Featured)
Your performance is front and center with:
- **Performance Score**: 0-100 points with detailed breakdown
- **KDA**: Kills/Deaths/Assists with ratio calculation
- **Kill Participation**: Percentage of team kills you were involved in
- **Creep Score**: Total CS and per-minute rate
- **Damage**: Total champion damage and per-minute rate
- **Vision Score**: Total vision and per-minute rate
- **Gold Earned**: Total gold accumulated in the match
- **Items**: Visual display of complete build

### Team Compositions
**Allied Team (5 players)**
- Your stats highlighted with **bold** and **➤** marker
- Each teammate's champion and KDA shown
- Quick overview of team performance

**Enemy Team (5 players)**
- All opponents' champions and KDA
- Helps understand who was fed/behind
- Context for the match difficulty

## 🎯 Scoring System

### 100-Point Performance Score

**Win/Loss (30 points)**
- Victory: 30 points
- Defeat: 0 points

**KDA Ratio (25 points)**
- Perfect (0 deaths): 25 points
- KDA ≥ 5.0: 25 points
- KDA ≥ 3.0: 20 points
- KDA ≥ 2.0: 15 points
- KDA ≥ 1.0: 10 points
- KDA < 1.0: 5 points

**Kill Participation (15 points)**
- Proportional to KP percentage
- 100% KP = 15 points
- Rewards team fighting

**CS per Minute (10 points)**
- ≥8 CS/min: 10 points
- ≥6 CS/min: 7 points
- ≥4 CS/min: 5 points
- <4 CS/min: 2 points

**Vision per Minute (10 points)**
- ≥2 vision/min: 10 points
- ≥1.5 vision/min: 7 points
- ≥1 vision/min: 5 points
- <1 vision/min: 2 points

**Damage per Minute (10 points)**
- ≥800 dmg/min: 10 points
- ≥600 dmg/min: 7 points
- ≥400 dmg/min: 5 points
- <400 dmg/min: 2 points

## 🤖 Discord Commands

### `/setup` (Admin Only)
Configure the notification channel for match results.
```
/setup channel:#lol-matches
```

### `/register`
Add a League of Legends account to track.
```
/register gamename:Faker tag:KR1
```
- Uses modern Riot ID format (Game Name#Tag)
- Validates account exists via Riot API
- Prevents duplicate registrations

### `/unregister`
Remove a tracked account from the server.
```
/unregister gamename:Faker tag:KR1
```
- Only removes from current server
- Doesn't affect other servers tracking same player

### `/list`
Display all tracked accounts in the current server.
```
/list
```
- Shows Riot ID and summoner name
- Displays region for each account
- Shows total number of tracked accounts

## 🗄️ Database Features

### SQLite Database
- **Lightweight**: Single file database, easy to backup
- **Fast**: In-memory optimizations with WAL mode
- **Persistent**: Data survives restarts
- **Docker Volume**: Data persisted in `/app/data`

### Stored Data
1. **Tracked Accounts**
   - Guild ID, Riot ID, Summoner Name, PUUID, Region
   - Last match ID to detect new games
   - Creation timestamp

2. **Guild Settings**
   - Notification channel per server
   - Expandable for future settings

3. **Processed Matches**
   - Match ID and PUUID pairs
   - Prevents duplicate notifications
   - Automatic deduplication

### Database Indexes
Optimized queries with indexes on:
- Guild ID (for server-specific lookups)
- PUUID (for player lookups)
- Match processing checks

## 🚀 Deployment Features

### Docker Ready
- **Dockerfile**: Optimized Node.js 18 Alpine image
- **docker-compose.yml**: One-command deployment
- **Persistent Volumes**: Database survives container restarts
- **Auto-Restart**: Container restarts on failure
- **Log Rotation**: 10MB max, 3 files retained

### Environment Configuration
All sensitive data in `.env` file:
- Discord bot token and client ID
- Riot API key
- Region settings
- Database path
- Check interval

### Production Ready
- **Graceful Shutdown**: SIGINT/SIGTERM handlers
- **Error Handling**: Comprehensive try-catch blocks
- **Logging**: Console logs for debugging
- **Rate Limit Friendly**: Configurable check intervals

## 🌍 Region Support

### Supported Regions
**Platform Regions** (RIOT_REGION):
- `euw1`, `eun1` (Europe West, Nordic & East)
- `na1` (North America)
- `kr` (Korea)
- `br1` (Brazil)
- `jp1` (Japan)
- `la1`, `la2` (Latin America North/South)
- `oc1` (Oceania)
- `tr1` (Turkey)
- `ru` (Russia)
- `ph2`, `sg2`, `th2`, `tw2`, `vn2` (Southeast Asia)

**Routing Regions** (RIOT_ROUTING):
- `europe` (EUW, EUNE, TR, RU)
- `americas` (NA, BR, LAN, LAS)
- `asia` (KR, JP)
- `sea` (OCE, PH, SG, TH, TW, VN)

## 🎨 UX/UI Design Philosophy

### Player-Centric
Your stats are the star of the show:
- Largest, most prominent display
- Highlighted in team composition
- Clear visual hierarchy

### Information Dense Yet Clean
- Organized into clear sections
- Visual separators between categories
- Code blocks for clean number display
- Emojis for quick visual scanning

### Professional Gaming Aesthetic
- Official League of Legends assets
- Color scheme matches game
- Modern Discord embed design
- Looks like an official Riot bot

### At-a-Glance Understanding
Within 2 seconds, you should know:
1. Did you win or lose? (Color + Title)
2. How well did you play? (Score bar)
3. Your KDA (First stat shown)
4. How your team did (Team compositions)

## 🔒 Security Features

### API Key Protection
- All keys in `.env` file (gitignored)
- Never committed to repository
- Separate example file for documentation

### Permission Checks
- `/setup` requires Administrator permission
- Bot only requests necessary Discord permissions
- Read-only database access patterns

### Error Handling
- API failures don't crash bot
- Invalid accounts handled gracefully
- Network errors logged but continued

## 📈 Scalability

### Performance
- Checks all accounts in parallel
- Efficient database queries with indexes
- Minimal API calls (one per account per check)
- Smart caching with processed matches

### Resource Usage
- Low memory footprint (~50-100MB)
- Minimal CPU usage
- Single SQLite file for data
- No external service dependencies

### Limitations
- Check interval minimum: 1 minute (rate limit friendly)
- Riot API rate limits (varies by key type)
- Discord embed size limits (handled automatically)

## 🛠️ Maintenance

### Easy Updates
- Pull new code
- Rebuild Docker container
- Database migrations automatic
- Zero downtime with proper orchestration

### Monitoring
- Console logs for all operations
- Error tracking per account
- Match processing confirmations
- Bot status in Discord (online/offline)

### Backup
- Single database file to backup
- Export data with SQLite tools
- Easy migration between servers

---

This bot provides a comprehensive, beautiful, and professional League of Legends tracking experience for Discord servers!
