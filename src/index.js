require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const DatabaseManager = require('./database/db');
const RiotAPI = require('./services/riotApi');
const MatchTracker = require('./services/matchTracker');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

const database = new DatabaseManager(process.env.DATABASE_PATH || './data/bot.db');
const riotApi = new RiotAPI(
  process.env.RIOT_API_KEY,
  process.env.RIOT_REGION || 'euw1',
  process.env.RIOT_ROUTING || 'europe'
);

const matchTracker = new MatchTracker(
  client,
  database,
  riotApi,
  parseInt(process.env.CHECK_INTERVAL) || 120000
);

async function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }

  return commands;
}

async function registerCommands(commands) {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is in ${client.guilds.cache.size} server(s)`);

  matchTracker.start();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction, database, riotApi);
  } catch (error) {
    console.error('Error executing command:', error);
    const reply = {
      content: '❌ There was an error while executing this command!',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  matchTracker.stop();
  database.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  matchTracker.stop();
  database.close();
  client.destroy();
  process.exit(0);
});

async function start() {
  try {
    const commands = await loadCommands();
    await registerCommands(commands);
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

start();
