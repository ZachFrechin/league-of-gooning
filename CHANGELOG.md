# Changelog

## Version 2.0.0 - Enhanced Visual Design (Current)

### 🎨 Major Visual Improvements

**Champion Icons**
- ✅ Champion icon displayed as author avatar
- ✅ Large champion thumbnail on the right side
- ✅ Uses official Riot Data Dragon CDN

**Item Visualization**
- ✅ All 6 items + trinket displayed as inline images
- ✅ Official League of Legends item icons
- ✅ Smart filtering (only shows purchased items)

**Team Compositions**
- ✅ Full allied team (5 players) with KDA scores
- ✅ Full enemy team (5 players) with KDA scores
- ✅ Player stats highlighted with ➤ marker and bold text
- ✅ Side-by-side display for easy comparison

**Performance Score Bar**
- ✅ Visual 20-segment progress bar
- ✅ Color-coded: Green (80+), Yellow (60+), Orange (40+), Red (0-39)
- ✅ Large prominent display at the top

**Enhanced Layout**
- ✅ Beautiful section separators with Unicode characters
- ✅ Clean code blocks for stat grouping
- ✅ Professional gaming aesthetic
- ✅ Player-centric design with clear hierarchy
- ✅ Added gold earned statistic

**Color Scheme**
- ✅ Victory: Blue (#3498db) instead of green
- ✅ Defeat: Red (#e74c3c)
- ✅ More modern Discord-friendly colors

### 📊 Statistics Improvements

**New Stats Added**
- Gold earned display
- Enhanced KDA formatting with spacing
- Better damage/vision/CS per-minute displays

**Better Organization**
- Stats grouped in logical sections
- Visual hierarchy emphasizes important metrics
- Player stats front and center

### 🎯 UX Improvements

**At-a-Glance Understanding**
- Title shows result + queue type immediately
- Description has champion + level + duration
- Score bar visible before scrolling
- Clean visual flow from top to bottom

**Information Architecture**
1. Performance score (most important)
2. Personal stats (detailed)
3. Items (visual build)
4. Team context (who played with/against)

## Version 1.0.0 - Initial Release

### ✨ Core Features

**Bot Commands**
- `/setup` - Configure notification channel
- `/register` - Add account to track
- `/unregister` - Remove tracked account
- `/list` - View all tracked accounts

**Automatic Tracking**
- Monitor accounts every 2 minutes
- Detect new completed matches
- Post notifications to Discord
- SQLite database for persistence

**Performance Scoring**
- 100-point scoring system
- Factors: Win/Loss, KDA, KP, CS, Vision, Damage
- Weighted algorithm for fair assessment

**Match Statistics**
- KDA and ratio
- Kill participation
- CS and CS per minute
- Vision score and per minute
- Damage and per minute
- Queue type and duration

**Technical**
- Docker support
- Environment variable configuration
- Multi-region support
- Error handling and logging
- Graceful shutdown

### 🗄️ Database

**Tables**
- tracked_accounts
- guild_settings
- processed_matches

**Features**
- Automatic schema creation
- Indexed queries
- WAL mode for performance
- Duplicate prevention

### 🌍 Region Support

**Platform Regions**
- EUW, EUNE, NA, KR, BR, JP, OCE, TR, RU
- LAN, LAS, PH, SG, TH, TW, VN

**Routing Regions**
- Europe, Americas, Asia, SEA

---

## Future Enhancements (Potential)

### Possible Future Features
- [ ] Summoner spell displays
- [ ] Rune display
- [ ] Multi-kill announcements (Pentakill!)
- [ ] Rank change tracking
- [ ] Match history command
- [ ] Player statistics over time
- [ ] Leaderboard per server
- [ ] Custom scoring formulas
- [ ] Role detection
- [ ] Mastery points tracking
- [ ] Champion statistics
- [ ] Win streak tracking
- [ ] Weekly/monthly summaries

### Technical Improvements
- [ ] Web dashboard for configuration
- [ ] GraphQL API
- [ ] PostgreSQL support
- [ ] Horizontal scaling
- [ ] Prometheus metrics
- [ ] Health check endpoints
- [ ] Automated tests
- [ ] CI/CD pipeline
