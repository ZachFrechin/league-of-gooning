# Quick Start Guide

Get your League of Legends Discord bot up and running in 5 minutes!

## Step 1: Get Your API Keys

### Discord Bot Token
1. Go to https://discord.com/developers/applications
2. Click "New Application" → Give it a name
3. Go to "Bot" → Click "Add Bot"
4. Copy the **Token**
5. Copy the **Application ID** from "General Information"

### Riot API Key
1. Go to https://developer.riotgames.com/
2. Sign in and generate an API key
3. Copy the key

## Step 2: Invite Bot to Server

Replace `YOUR_APPLICATION_ID` with your Application ID:
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_APPLICATION_ID&permissions=2048&scope=bot%20applications.commands
```

## Step 3: Deploy with Docker

```bash
# 1. Create .env file
cp .env.example .env

# 2. Edit .env with your keys
nano .env

# 3. Start the bot
docker-compose up -d

# 4. Check logs
docker-compose logs -f
```

## Step 4: Configure in Discord

```
1. /setup channel:#your-channel     # Set notification channel
2. /register gamename:Faker tag:KR1 # Add a player to track
3. Wait for them to finish a game!
```

## That's it!

Your bot is now tracking League of Legends games and posting results automatically!

## Need Help?

See the full [README.md](README.md) for detailed instructions and troubleshooting.
