require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');

const DATA_FILE = './users.json';

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.DirectMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel] 
});

// Helper to load/save user data
function loadUsers() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function saveUsers(users) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}!`);

    // Greet at 9 AM every day
    cron.schedule('0 9 * * *', async () => {
        const users = loadUsers();
        for (const userId in users) {
            const user = users[userId];
            if (!user.optedOut) {
                try {
                    const discordUser = await client.users.fetch(userId);
                    await discordUser.send("Good morning! ☀️ What is your fitness goal for today?");
                } catch (err) {
                    console.error(`Failed to send 9AM DM to ${userId}:`, err);
                }
            }
        }
    });

    // Remind at 10 PM every day
    cron.schedule('0 22 * * *', async () => {
        const users = loadUsers();
        for (const userId in users) {
            const user = users[userId];
            if (!user.optedOut && user.dailyGoal) {
                try {
                    const discordUser = await client.users.fetch(userId);
                    await discordUser.send(`It's 10 PM! 🌙 How did you do with your goal: "${user.dailyGoal}"?`);
                    // Reset goal for next day
                    user.dailyGoal = null;
                } catch (err) {
                    console.error(`Failed to send 10PM DM to ${userId}:`, err);
                }
            }
        }
        saveUsers(users);
    });
});

client.on('messageCreate', async msg => {
    if (msg.author.bot) return;

    // Check if the message is a DM
    if (!msg.guild) {
        const userId = msg.author.id;
        const users = loadUsers();
        
        // Initialize user if they haven't communicated before
        if (!users[userId]) {
            users[userId] = {
                optedOut: false,
                dailyGoal: null
            };
            saveUsers(users);
            console.log(`New user started communicating: ${msg.author.tag}`);
        }

        const content = msg.content.trim();

        // Handle commands
        if (content === '!optout') {
            users[userId].optedOut = true;
            saveUsers(users);
            return msg.reply("You have opted out of daily notifications. Send `!optin` to re-enable.");
        }

        if (content === '!optin') {
            users[userId].optedOut = false;
            saveUsers(users);
            return msg.reply("Daily notifications have been re-enabled! I'll greet you at 9 AM tomorrow.");
        }

        if (content.startsWith('/set ')) {
            const goal = content.slice(5).trim();
            if (!goal) return msg.reply("Please provide a goal! Example: `/set Run 5km`.");
            
            users[userId].dailyGoal = goal;
            saveUsers(users);
            return msg.reply(`Got it! I've set your goal for today: "${goal}". I'll check in with you at 10 PM tonight! 💪`);
        }

        if (content === '/unset') {
            users[userId].dailyGoal = null;
            saveUsers(users);
            return msg.reply("Your goal for today has been cleared. I won't remind you tonight! 🌙");
        }

        if (content === '/status') {
            const user = users[userId];
            if (user.dailyGoal) {
                return msg.reply(`Your current goal is: "${user.dailyGoal}". Keep going! 💪`);
            } else {
                const suggestions = [
                    "Go to LA Fitness",
                    "Play some pickleball",
                    "Do a Youtube workout"
                ];
                const randomGoal = suggestions[Math.floor(Math.random() * suggestions.length)];
                return msg.reply(`You haven't set a goal yet today! 🏃‍♂️ Why not try this: **${randomGoal}**?\n\nUse \`/set [goal]\` to get started!`);
            }
        }

        // Default reply for other messages
        msg.reply("I received your message! 📩 Use `/set [your goal]` to set a goal for today, `/status` to check progress, or `/unset` to clear it.");
    }
});

client.login(process.env.DISCORD_TOKEN);
