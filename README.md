# League of Legends Discord Tracker Bot

A Discord bot that automatically tracks League of Legends players and posts game results with detailed statistics and performance scores to a designated Discord channel.

## Features

- **Automatic Match Tracking**: Monitor registered League of Legends accounts and get notified when they finish games
- **Detailed Statistics**: View comprehensive match data including KDA, CS, vision score, damage, and kill participation
- **Performance Scoring**: Automatic 100-point scoring system based on multiple performance metrics
- **Multiple Account Support**: Track multiple LoL accounts per Discord server
- **Configurable Notifications**: Set up a specific channel for match result notifications
- **Slash Commands**: Easy-to-use Discord slash commands for managing tracked accounts

## Prerequisites

Before you begin, ensure you have the following:

1. **Node.js** (v18 or higher) OR **Docker** and **Docker Compose**
2. **Discord Bot Token**: Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
3. **Riot Games API Key**: Get your API key from [Riot Developer Portal](https://developer.riotgames.com/)

## Discord Bot Setup

### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section
4. Click "Add Bot"
5. Copy the **Bot Token** (you'll need this for `.env`)
6. Enable these Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent (optional)

### 2. Get Application ID

1. In your application, go to "General Information"
2. Copy the **Application ID** (this is your `DISCORD_CLIENT_ID`)

### 3. Invite the Bot to Your Server

Use this URL template (replace `YOUR_CLIENT_ID` with your Application ID):

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

Required permissions:
- Send Messages
- Embed Links
- Use Slash Commands

## Riot Games API Setup

1. Go to [Riot Developer Portal](https://developer.riotgames.com/)
2. Sign in with your Riot account
3. Generate an API key (Development key for testing, Production key for long-term use)
4. Copy the API key (you'll need this for `.env`)

**Note**: Development keys expire every 24 hours. For production use, apply for a Production API key.

## Installation

### Method 1: Docker (Recommended for VPS)

1. Clone or upload the project to your VPS

2. Create a `.env` file from the example:
```bash
cp .env.example .env
```

3. Edit the `.env` file with your credentials:
```bash
nano .env
```

Fill in the following:
```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
RIOT_API_KEY=your_riot_api_key_here
RIOT_REGION=euw1
RIOT_ROUTING=europe
DATABASE_PATH=/app/data/bot.db
CHECK_INTERVAL=120000
```

**Region Configuration**:
- `RIOT_REGION`: Server region (e.g., `euw1`, `na1`, `kr`, `br1`)
- `RIOT_ROUTING`: Routing region for match data
  - `europe` for EUW, EUNE
  - `americas` for NA, BR, LAN, LAS
  - `asia` for KR, JP
  - `sea` for OCE, PH, SG, TH, TW, VN

4. Build and run with Docker Compose:
```bash
docker-compose up -d
```

5. Check the logs:
```bash
docker-compose logs -f
```

6. Stop the bot:
```bash
docker-compose down
```

### Method 2: Manual Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Edit the `.env` file with your credentials (same as above)

4. Create data directory:
```bash
mkdir data
```

5. Run the bot:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Bot Commands

The bot uses Discord slash commands. All commands will appear when you type `/` in Discord.

### `/setup`
**Required Permission**: Administrator

Set the Discord channel where match notifications will be posted.

```
/setup channel:#lol-tracker
```

### `/register`
Register a League of Legends account to track.

```
/register gamename:PlayerName tag:EUW
```

**Example**: `/register gamename:Faker tag:KR1`

**Note**: Use the Riot ID format (Game Name + Tag), not the summoner name.

### `/unregister`
Remove a tracked League of Legends account.

```
/unregister gamename:PlayerName tag:EUW
```

### `/list`
Display all tracked League of Legends accounts in the server.

```
/list
```

## Match Notification Format

When a tracked player finishes a game, the bot posts a beautiful, detailed embed with:

### Visual Elements
- **Champion Icon**: Player's champion portrait displayed as thumbnail and author icon
- **Item Images**: All player's items shown with official League of Legends item icons
- **Color Coding**: Blue for victories, red for defeats
- **Score Bar**: Visual 20-segment bar showing performance (green/yellow/orange/red)

### Player Stats (Highlighted in Big)
- **Performance Score**: 0-100 points with visual progress bar
- **KDA**: Kills/Deaths/Assists with KDA ratio
- **Kill Participation**: Percentage of team kills participated in
- **Creep Score**: Total CS and CS per minute
- **Damage**: Total champion damage and damage per minute
- **Vision Score**: Total vision and vision per minute
- **Gold**: Total gold earned
- **Items**: Visual display of all equipped items

### Team Information
- **Allied Team Composition**: All 5 teammates with their champion and KDA (your stats highlighted with ➤)
- **Enemy Team Composition**: All 5 opponents with their champion and KDA
- **Game Info**: Queue type, duration, and match ID

### Scoring System (100 points total)

- **Win/Loss**: 30 points (30 for win, 0 for loss)
- **KDA**: Up to 25 points
  - 25 points: KDA ≥ 5.0
  - 20 points: KDA ≥ 3.0
  - 15 points: KDA ≥ 2.0
  - 10 points: KDA ≥ 1.0
  - 5 points: KDA < 1.0
- **Kill Participation**: Up to 15 points (proportional to KP%)
- **CS per Minute**: Up to 10 points
  - 10 points: ≥8 CS/min
  - 7 points: ≥6 CS/min
  - 5 points: ≥4 CS/min
  - 2 points: <4 CS/min
- **Vision per Minute**: Up to 10 points
  - 10 points: ≥2 vision/min
  - 7 points: ≥1.5 vision/min
  - 5 points: ≥1 vision/min
  - 2 points: <1 vision/min
- **Damage per Minute**: Up to 10 points
  - 10 points: ≥800 damage/min
  - 7 points: ≥600 damage/min
  - 5 points: ≥400 damage/min
  - 2 points: <400 damage/min

## Configuration

### Environment Variables

- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application ID
- `RIOT_API_KEY`: Your Riot Games API key
- `RIOT_REGION`: League of Legends server region (default: `euw1`)
- `RIOT_ROUTING`: Riot API routing region (default: `europe`)
- `DATABASE_PATH`: Path to SQLite database file (default: `./data/bot.db`)
- `CHECK_INTERVAL`: Match check interval in milliseconds (default: `120000` = 2 minutes)

### Match Check Interval

The bot checks for new matches every 2 minutes by default. You can adjust this by changing `CHECK_INTERVAL` in your `.env` file:

```env
CHECK_INTERVAL=60000    # 1 minute
CHECK_INTERVAL=120000   # 2 minutes (default)
CHECK_INTERVAL=300000   # 5 minutes
```

**Note**: Lower intervals mean more API requests. Be mindful of Riot API rate limits.

## Troubleshooting

### Bot is not responding to commands
- Make sure the bot has the "Use Slash Commands" permission
- Check if the bot is online in your server
- Verify the bot token in `.env` is correct

### "Account not found" error
- Use the Riot ID format (Game Name#Tag), not the old summoner name
- Check the tag is correct (e.g., EUW, NA1, KR)
- Verify the account exists on the specified region

### No match notifications
- Ensure you've set up a notification channel with `/setup`
- Check if the bot has permission to send messages in that channel
- Verify `RIOT_API_KEY` is valid and not expired
- Check the bot logs for errors

### API rate limit errors
- Development API keys have strict rate limits
- Consider increasing `CHECK_INTERVAL` to reduce API calls
- Apply for a Production API key for higher limits

### Docker container keeps restarting
- Check logs: `docker-compose logs -f`
- Verify all environment variables in `.env` are correct
- Ensure the `data` directory has proper permissions

## Updating the Bot

### Docker
```bash
docker-compose down
docker-compose pull
docker-compose up -d --build
```

### Manual
```bash
git pull
npm install
npm start
```

## Database

The bot uses SQLite to store:
- Tracked accounts per Discord server
- Guild settings (notification channels)
- Processed match IDs to prevent duplicates

The database file is stored in the `data/` directory and persists between restarts.

## Project Structure

```
.
├── src/
│   ├── commands/           # Discord slash commands
│   │   ├── register.js     # Register LoL account
│   │   ├── unregister.js   # Unregister LoL account
│   │   ├── list.js         # List tracked accounts
│   │   └── setup.js        # Set notification channel
│   ├── database/
│   │   └── db.js           # Database manager
│   ├── services/
│   │   ├── riotApi.js      # Riot API client
│   │   └── matchTracker.js # Match monitoring service
│   ├── utils/
│   │   └── matchFormatter.js # Match result formatter
│   └── index.js            # Main bot file
├── data/                   # Database storage (created at runtime)
├── .env                    # Environment variables (create from .env.example)
├── .env.example            # Example environment file
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## License

MIT License - feel free to use this bot for your own Discord servers!

## Support

If you encounter any issues or have questions, please open an issue on the GitHub repository.

---

**Happy tracking!** May your KDA be high and your LP gains even higher! 🎮
