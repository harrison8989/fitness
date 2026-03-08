require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.DirectMessages, // Allows the bot to see DMs
        GatewayIntentBits.MessageContent  // Allows the bot to read the text
    ],
    partials: [Partials.Channel] // Vital for DMs to work!
});

client.once('clientReady', () => {
    console.log(`Bot is online as ${client.user.tag}!`);
    console.log("Go to Discord and send me a DM!");
});

client.on('messageCreate', msg => {
    // Ignore messages from the bot itself
    if (msg.author.bot) return;

    // Check if the message is a DM
    if (!msg.guild) {
        console.log(`Received DM from ${msg.author.tag}: ${msg.content}`);
        msg.reply("I received your DM! 📩");
    }
});

client.login(process.env.DISCORD_TOKEN);

