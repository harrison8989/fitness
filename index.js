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
                    await discordUser.send("Good morning! ☀️ What are your fitness goals for today?");
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
            const goals = user.dailyGoals || [];
            if (!user.optedOut && goals.length > 0) {
                try {
                    const discordUser = await client.users.fetch(userId);
                    const goalList = goals.map(g => `"${g}"`).join('\n- ');
                    const goalText = goals.length === 1 ? `goal: ${goalList}` : `goals:\n- ${goalList}`;
                    await discordUser.send(`It's 10 PM! 🌙 How did you do with your ${goalText}?`);
                    // Reset goals for next day
                    user.dailyGoals = [];
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
                dailyGoals: []
            };
            saveUsers(users);
            console.log(`New user started communicating: ${msg.author.tag}`);
        }

        const content = msg.content.trim();

        // Handle commands
        if (content === '/optout') {
            users[userId].optedOut = true;
            saveUsers(users);
            return msg.reply("You have opted out of daily notifications. Use `/optin` to re-enable.");
        }

        if (content === '/optin') {
            users[userId].optedOut = false;
            saveUsers(users);
            return msg.reply("Daily notifications have been re-enabled! I'll greet you at 9 AM tomorrow.");
        }

        if (content.startsWith('/set ')) {
            const goal = content.slice(5).trim();
            if (!goal) return msg.reply("Please provide a goal! Example: `/set Run 5km`.");
            
            if (!users[userId].dailyGoals) {
                users[userId].dailyGoals = [];
            }
            users[userId].dailyGoals.push(goal);
            saveUsers(users);
            
            const goalCount = users[userId].dailyGoals.length;
            const goalWord = goalCount === 1 ? 'goal' : 'goals';
            return msg.reply(`Got it! I've added your goal: "${goal}". You now have ${goalCount} ${goalWord} set for today. I'll check in with you at 10 PM tonight! 💪`);
        }

        if (content === '/unset') {
            users[userId].dailyGoals = [];
            saveUsers(users);
            return msg.reply("Your goals for today have been cleared. I won't remind you tonight! 🌙");
        }

        if (content === '/status') {
            const user = users[userId];
            const goals = user.dailyGoals || [];
            if (goals.length > 0) {
                const goalList = goals.map((g, i) => `${i + 1}. ${g}`).join('\n');
                return msg.reply(`Your current goals for today are:\n${goalList}\nKeep going! 💪`);
            } else {
                const suggestions = [
                    "Go to LA Fitness",
                    "Play some pickleball",
                    "Do a Youtube workout"
                ];
                const randomGoal = suggestions[Math.floor(Math.random() * suggestions.length)];
                return msg.reply(`You haven't set any goals yet today! 🏃‍♂️ Why not try this: **${randomGoal}**?\n\nUse \`/set [goal]\` to get started!`);
            }
        }

        // Default reply for other messages
        msg.reply("I'm a friendly fitness bot here to help you stay on track! 🏃‍♂️ I just want to check in on how you're doing with your goals today.\n\nHere's how you can interact with me:\n- `/set [goal]` – Add a new goal for today\n- `/status` – See all your current goals\n- `/unset` – Clear all your goals for today\n- `/optout` – Stop receiving daily reminders\n- `/optin` – Re-enable daily reminders");
    }
});

client.login(process.env.DISCORD_TOKEN);
