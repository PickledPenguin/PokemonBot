const POSSIBLE_PERKS = {
  "DYNAMAX_PEOPLE_ID": "Dynamax",
  "BOUNTY_PERSON_ID": "Bounty",
  "PLOT_ARMOR_PERSON_ID": "Plot Armor",
  "SWIPER_PEOPLE_ID": "Swiper",
  "VERMIN_WHISPERER_PERSON_ID": "Vermin Whisperer",
};

const ALLOWED_CHANNELS=[1065049126871515176n, 1065064038427541594n, 1053540259717189714n]



const express = require('express')
const app = express()
const fs = require('fs')
var cron = require('node-cron')
require("dotenv").config()

// imports all the util functions
var util = require('./util')

// imports all the long typed messages
var written_messages = require('./written-messages')

const { OpenAI } = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_TOKEN,
});

var saveData;
global.saveData = load(saveData);

app.get('/', (req, res) => {
  res.send("hello world!")
})

app.listen(3000, () => { console.log("Ready!") })

const discord = require('discord.js')
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
  ]
});

client.on('ready', () => { 
    console.log("Bot is ready");
})

// starts the daily pokemon rarity updates
cron.schedule('00 00 * * *', increaseRarity, {timezone: "America/New_York"});

// starts the weekly summary and perk updates
cron.schedule('0 12 * * 0', msgPerkUpdate, { timezone: "America/New_York" });



client.on('messageCreate', async msg => {

  // ignore non-commands, self messages, and other bot messages. Restrict messages to only the allowed channels
  if (!msg.content.startsWith('!') || msg.author === client.user || msg.author.bot || !ALLOWED_CHANNELS.includes(msg.channel.id)) {
    return;
  }

  else if (cmd(msg, 'help-pokemon')){
    sendLongMessage(msg.channel, written_messages.HELP_POKEMON);
  }

  else if (cmd(msg, 'help-commands')){
    sendLongMessage(msg.channel, written_messages.HELP_COMMANDS);
  }

  else if (cmd(msg, 'help-perks')) {
    sendLongMessage(msg.channel, written_messages.HELP_PERKS);
  }

  else if (cmd(msg, 'set-personality')){
    personality = msg.content.substring(16);

    // Check if the personality length exceeds the maximum limit
    if (personality.length > process.env.MAX_PERSONALITY_LENGTH) {
      msg.channel.send(`The personality description is too long. Please limit it to ${process.env.MAX_PERSONALITY_LENGTH} characters.`);
      return;
    }

    prev_personality = saveData[msg.author.id]["AIPersonality"];
    saveData[msg.author.id]["AIPersonality"] = personality;

    msg.channel.send("Changed personality from **" + prev_personality + "** to **" + personality + "**");

    save();
  }

  else if (cmd(msg, 'register')){
    setupDefaultsIfNecessary(msg.author);
    msg.channel.send("Successfully Registered :thumbsup:");
  }

  else if (msg.content.toLowerCase().includes('!status')) {

    const statusPerson = msg.mentions.users.first()

    if (checkOffLimits(msg)){
      return;
    }

    else if (!statusPerson) {
      msg.channel.send("No user mentioned, please specify who\'s status you want to see");
    }
    else {
      // try send status for author
      try {

        // Get the status person's data
        userData = saveData[statusPerson.id];

        if (!userData) {
            msg.channel.send("@" + statusPerson.username + " has 0 points and no pokedex");
        } else {
    
          let Pokedex = "{\n";
          for (let pokemon of Object.values(saveData[statusPerson.id]["pokedex"])) {
            Pokedex += "\t" + pokemon + ": " + userData["pokedex"][pokemon] + "\n";
          }
          Pokedex += "}";

          let perks_list = "{\n";
          for (const [perkId, perkName] of Object.entries(POSSIBLE_PERKS)) {
              if (userData[perkId] && userData[perkId] === userId) {
                perks_list += `\t${perkName}\n`;
              }
          }
          perks_list += "}";
          
          msg.channel.send("**@" + statusPerson.username + " Status**:\n\n Overall points: " + saveData[statusPerson.id]["points"] 
            + "\nWeekly points: " + saveData[statusPerson.id]["weekly_points"] 
            + "\nOverall BARNABY points: " + saveData[statusPerson.id]["barnaby_points"] 
            + "\nWeekly BARNABY points: " + saveData[statusPerson.id]["weekly_barnaby_points"] 
            + "\nPokedex: \n" + Pokedex
            + "\nPerks:" + perks_list );
        }
      } catch (e) {
        // if no status found for author
        msg.channel.send("No status found for @" + statusPerson.username);
      }
    }
  }

  else if (cmd(msg, 'opt-out')){
    setupDefaultsIfNecessary(msg.author);
    saveData[msg.author.id]["wants-to-play"] = false;
    msg.channel.send("Successfully opted out for playing the game. Any catch messages that mention you will be deleted")
    save();
  }

  else if (cmd(msg, 'opt-in')){
    setupDefaultsIfNecessary(msg.author);
    saveData[msg.author.id]["wants-to-play"] = true;
    msg.channel.send("Successfully opted in to playing the game. Happy hunting :grin:");
    save();
  }

  else if (cmd(msg, 'off-limits')){
    result = "Here are all the people who does NOT want to be involved in the game:\n\n"
    for (let key of Object.keys(saveData)) {
      if (!saveData[key]["wants-to-play"]){
        result += "\t**" + saveData[key]["username"] + "**\n";
      }
    }
    result += "\nAny \"!catch\" messages that mention these people will be deleted";
    msg.channel.send(result);
  }

  else if (cmd(msg, 'catch')) {

    if (checkOffLimits(msg)) {
        return;
    }

    users_mentioned = msg.mentions.users.size;
    msg.mentions.users.forEach(CaughtPerson => {
        let caughtPerson = CaughtPerson[1];
        
        const catchCheck = isCatchAllowed(msg.author.id, caughtPerson.id);

        if (!catchCheck.allowed) {
            msg.channel.send(`Catches between you and ${caughtPerson} are still on cooldown for ${catchCheck.remainingTime} minute(s).`);
            return;
        }

        if (msg.author.id === caughtPerson.id) {
            askAI("A user has tried to 'catch' themselves. Ridicule them for attempting such a ridiculous thing.", msg.author.id)
                .then(response => sendLongMessage(msg.channel,response));
        } else if (caughtPerson.id === process.env.BOT) {
            askAI("A user has tried to 'catch' YOU and was obviously unsuccessful! Ridicule them for attempting such a ridiculous thing.", msg.author.id)
                .then(response => sendLongMessage(msg.channel,response));
        } else {
            setupDefaultsIfNecessary(msg.author);
            setupDefaultsIfNecessary(caughtPerson);

            const currentGuild = client.guilds.cache.get(process.env.GUILD_ID);
            currentGuild.members.fetch(caughtPerson.id).then(person => {

                let multiplier = handleSpecialPerks(msg, msg.author, caughtPerson);

                if (multiplier == null) {
                    askAI("A user has tried to 'catch' another user, but was unsuccessful because of the other user's special PLOT ARMOR feature.", msg.author.id)
                    .then(response => sendLongMessage(msg.channel,response));
                } else {
                    if (person.roles.cache.some(role => role.name === "Shiny")) {
                        awardPointsAndSendMessage(msg, msg.author, caughtPerson, "Shiny", 10, multiplier);
                    } else if (person.roles.cache.some(role => role.name === "Rare")) {
                        awardPointsAndSendMessage(msg, msg.author, caughtPerson, "Rare", 5, multiplier);
                    } else if (person.roles.cache.some(role => role.name === "Uncommon")) {
                        awardPointsAndSendMessage(msg, msg.author, caughtPerson, "Uncommon", 3, multiplier);
                    } else {
                        awardPointsAndSendMessage(msg, msg.author, caughtPerson, "Normal", 1, multiplier);
                    }

                    const seasonKey = caughtPerson.id + saveData["SEASON_ID"];
                    const pokemonEntry = `${saveData["SEASON_EMOJI"]} ${caughtPerson.username} ${saveData["SEASON_EMOJI"]}`;

                    // Increment the Pokedex entry (first initialize if necessary)
                    saveData[msg.author.id]["pokedex"][seasonKey] = saveData[msg.author.id]["pokedex"][seasonKey] || {};
                    saveData[msg.author.id]["pokedex"][seasonKey][pokemonEntry] = (saveData[msg.author.id]["pokedex"][seasonKey][pokemonEntry] || 0) + 1;

                    // Reset the rarity value of the caught person
                    saveData[caughtPerson.id]["rarityValue"] = 0;

                    // Set the cooldown after a successful catch
                    setCatchCooldown(msg.author.id, caughtPerson.id);
                }

                save();

            }).catch(console.error);
        }
    });
  }

  else if (cmd(msg, 'leaderboard')) {
    
    saveData = load(saveData);

      // Get the top 10 users by overall total points
      const topUsersByPoints = Object.values(saveData)
        .filter(user => user["wants-to-play"])
        .sort((a, b) => b["points"] - a["points"])
        .slice(0, 10);
      // Send the overall total leaderboard
      msg.channel.send("Overall TOTAL point leaderboard:\n" + 
        topUsersByPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["points"]}`).join('\n')
      );

      // Get the top 10 users by overall total barnaby points
      const topUsersByBarnabyPoints = Object.values(saveData)
        .filter(user => user["wants-to-play"])
        .sort((a, b) => b["barnaby_points"] - a["barnaby_points"])
        .slice(0, 10);
      // Send the overall total leaderboard
      msg.channel.send("Overall BARNABY point leaderboard:\n" + 
        topUsersByBarnabyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["barnaby_points"]}`).join('\n')
      );

      // I only send the overall total point/barnaby point leaderboard and not any weekly leaderboards because its more suspensful that way
    }

  else if (cmd(msg, 'add-points')) {
    const incrementPerson = msg.mentions.users.first();
    const pointAmount = parseInt(msg.content.split(' ')[2]);

    const response = await adjustPoints(msg, incrementPerson, pointAmount, true);
    msg.channel.send(response);
  }

  else if (cmd(msg, 'subtract-points')) {
    const decrementPerson = msg.mentions.users.first();
    const pointAmount = parseInt(msg.content.split(' ')[2]);

    const response = await adjustPoints(msg, decrementPerson, pointAmount, false);
    msg.channel.send(response);
  }

  else if (cmd(msg, 'get-rarity')) {
    saveData = load(saveData);
    msg.channel.send(`${setRarityPerson.username} has a rarity value of ${saveData[setRarityPerson.id]["rarity"]}`);
  }

  else if (cmd(msg, 'set-rarity')) {
    saveData = load(saveData);
    const setRarityPerson = msg.mentions.users.first();
    const setRarityAmount = parseInt(msg.content.split(' ')[2]);
    setRarity(msg, setRarityPerson, setRarityAmount);
  }

  else if (cmd(msg, 'next-season')) {
    if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {

        saveData = load(saveData);

        const seasons = ["SUMMER", "FALL", "WINTER", "SPRING"];
        const emojis = [":sunny:", ":fallen_leaf:", ":snowflake:", ":herb:"];

        // Get the current season index and calculate the next season
        let currentSeasonIndex = seasons.indexOf(saveData["SEASON_ID"] || "SUMMER");
        let nextSeasonIndex = (currentSeasonIndex + 1) % seasons.length;

        saveData["SEASON_ID"] = seasons[nextSeasonIndex];
        saveData["SEASON_EMOJI"] = emojis[nextSeasonIndex];

        save();

        msg.channel.send(`Welcome to the next season! The season ID is: ${saveData["SEASON_ID"]} and the season emoji is: ${saveData["SEASON_EMOJI"]}`);
    } else {
        msg.channel.send("You are not a PokemonBotManager :eyes:");
    }
  }

  else if (msg.content.toLowerCase().includes("!trigger-rarity-increase")){
    increaseRarity();
  }

})

client.login(process.env.TOKEN);