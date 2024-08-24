// All helper functions for index.js
const express = require('express')
const app = express()
const fs = require('fs')
var cron = require('node-cron')
require("dotenv").config()

const { OpenAI } = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_TOKEN,
});

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

var saveData;
global.saveData = load(saveData);

function cmd(msg, command_string){
    return msg.content.toLowerCase().includes(command_string);
}

async function askAI(prompt, author_id){
    console.log("prompt:\n" + prompt)
    console.log(author_id)
    const response = await openai.chat.completions.create({
        messages: [{role: "system", content: "You are an announcer in an online Pokemon-like game where several users attempt to \"catch\" various Pokemon and obtain points based on the rarity value of the Pokemon they catch, as well as add those Pokemon to their \"Pokedex\". Keep all following answers to a very short, concise paragraph. You personality should be: " + saveData[author_id]["AIPersonality"] + ". Make sure to answer all following prompts heavily flavored with your personality"}, 
        { role: "user", content: prompt }],
        model: "gpt-3.5-turbo",
      });
    console.log(response.choices[0].message.content);
    return response.choices[0].message.content;
}

async function adjustPoints(msg, user, amount, isIncrement) {
    if (!(msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID)) {
        return "You are not a PokémonBotManager :eyes:";
    }

    if (checkOffLimits(msg)) {
        return;
    }

    if (!user || checkOffLimits(msg)) {
        return "No user mentioned, please specify a person.";
    }

    if (isNaN(amount) || amount <= 0) {
        return "Please specify a valid number of points.";
    }

    if (saveData[user.id] === undefined) {
        setupDefaultsIfNecessary(user);
    }

    const currentPoints = saveData[user.id]["points"];
    const currentWeeklyPoints = saveData[user.id]["weekly_points"];

    if (isIncrement) {
        saveData[user.id]["points"] = currentPoints + amount;
        saveData[user.id]["weekly_points"] = currentWeeklyPoints + amount;
        return `Added ${amount} points to ${user.username}'s TOTAL and WEEKLY points.`;
    } else {
        saveData[user.id]["points"] = currentPoints - amount;
        saveData[user.id]["weekly_points"] = currentWeeklyPoints - amount;
        return `Subtracted ${amount} points from ${user.username}'s TOTAL and WEEKLY points.`;
    }
}

function setRarity(msg, setRarityPerson, amount) {
    if (!msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') && msg.author.id !== process.env.AUTHOR_ID) {
        return msg.channel.send("You are not a PokemonBotManager :eyes:");
    }

    if (checkOffLimits(msg)) {
        return;
    }

    if (!setRarityPerson) {
        return msg.channel.send("No user mentioned, please specify a person.");
    }

    setupDefaultsIfNecessary(setRarityPerson);

    if (saveData[setRarityPerson.id]["rarityValue"] === 0 && amount < 0) {
        msg.channel.send(`${setRarityPerson.username}'s rarity value is already at the minimum value of 0.`);
    } else {
        saveData[setRarityPerson.id]["rarityValue"] = amount;
        msg.channel.send(`Set ${setRarityPerson.username}'s rarity value to ${amount}`);
        save(saveData);
    }
}

function increaseRarity(){
    console.log("triggering-rarity-increase");
    saveData = load(saveData);
  
    const roleActions = [
        { threshold: 30, add: "Shiny", remove: ["Rare"] },
        { threshold: 14, add: "Rare", remove: ["Uncommon"] },
        { threshold: 7, add: "Uncommon", remove: [] },
    ];
  
    const removeRolesBelowThreshold = ["Uncommon", "Rare", "Shiny"];
  
    for (let user_id of Object.keys(saveData)) {
        let user_id_num = Number(user_id);
  
        // if the user_id is only numbers and the user wants to play
        if (!isNaN(user_id_num) && saveData[user_id]["wants-to-play"] === true) {
            
            const currentGuild = client.guilds.cache.find(g => g.id == process.env.GUILD_ID);
  
            currentGuild.members.fetch(user_id).then(member => {
  
                const userRarityValue = saveData[user_id]["rarityValue"];
  
                // Fetch the roles once
                const rolesCache = member.guild.roles.cache;
  
                // Assign roles based on the user's rarity value
                roleActions.forEach(action => {
                    if (userRarityValue >= action.threshold) {
                        let addRole = rolesCache.find(role => role.name === action.add);
                        if (addRole) member.roles.add(addRole);
                        action.remove.forEach(roleName => {
                            let removeRole = rolesCache.find(role => role.name === roleName);
                            if (removeRole) member.roles.remove(removeRole);
                        });
                    }
                });
  
                // Remove all roles if the rarity value is below 7
                if (userRarityValue < 7) {
                    removeRolesBelowThreshold.forEach(roleName => {
                        let role = rolesCache.find(r => r.name === roleName);
                        if (role && member.roles.cache.has(role.id)) {
                            member.roles.remove(role);
                        }
                    });
                }
  
                // Increment the user's rarity value
                saveData[user_id]["rarityValue"] += 1;
                save(saveData);
            }).catch(error => console.log(error));
        }
    }
}

// function to split up messages to send separately, to avoid issues with discord's limit of 2000 characters.
function splitMessage(str, size) {
    const numChunks = Math.ceil(str.length / size)
    const chunks = new Array(numChunks)

    for (let i = 0, c = 0; i < numChunks; ++i, c += size) {
        chunks[i] = str.substr(c, size)
    }
    return chunks;
}

// Function to send a long message in chunks
function sendLongMessage(channel, message) {
  const messageChunks = splitMessage(message, process.env.MAX_MESSAGE_LENGTH_BEFORE_SPLIT);

  messageChunks.forEach(chunk => {
      channel.send(chunk).catch(console.error);
  });
}

function setupDefaultsIfNecessary(user){
  if (saveData[user.id] === undefined) {
    saveData[user.id] = {"id": user.id, "points": 0, "weekly_points": 0,"barnaby_points": 0,"weekly_barnaby_points": 0,"username":user.username,"pokedex":{},"wants-to-play":true,"rarityValue":0,"AIPersonality":"Pokemon Announcer"};
  }
  save(saveData);
}

function checkOffLimits(msg){
    saveData = load(saveData);
    let isOffLimits = false;
    for (let Person of msg.mentions.users) {
        let person = Person[1];
        console.log(person)
        if (!saveData[person.id] || saveData[person.id]["wants-to-play"] == false){
            console.log(saveData[person.id]);
            isOffLimits = true;
            break;
        }
    }
    if (isOffLimits){
        msg.channel.send("There was someone mentioned in your message that has not registered or has opted out from playing the game!");
        msg.delete();
        return true;
    }
    return false;
}

function load() {
    try {
      var saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8'));
    } catch (e) {
        // init if no data found
        var saveData = {
            "SEASON_ID": "WINTER",
            "SEASON_EMOJI": ":snowflake:",
            "PLOT_ARMOR_PERSON_ID": undefined,
            "DYNAMAX_PEOPLE_ID": [],
            "VERMIN_WHISPERER_PERSON_ID": undefined,
            "SWIPER_PEOPLE_ID": [],
            "BOUNTY_PERSON_ID": undefined,
            "catchCooldowns": {}
        }
    }
    return saveData;
}

function save(saveData){
  fs.writeFileSync('./save-data.json', JSON.stringify(saveData));
}

function awardPointsAndSendMessage(msg, catcherID, caughtPersonID, rarity, basePoints, multiplier) {
  let pointsAwarded = basePoints * multiplier;

  catcherUsername = saveData[String(catcherID)]["username"];
  caughtPersonUsername = saveData["" + caughtPersonID]["username"];

  // Check if caughtPerson is a Barnaby catch 
  if (msg.mentions.users.size == 1 && caughtPersonID === process.env.BARNABY_ID) {
    // Find the amount of unique attachments in the catch message
    const uniqueAttachments = new Set();
    msg.attachments.forEach(attachment => {
      uniqueAttachments.add(attachment.url);
    });
    let attachment_limit = process.env.BARNABY_ATTACHMENT_LIMIT
    if (uniqueAttachments.size > attachment_limit) {
      // Limit the attachments to 10
      msg.channel.send("Sorry! The limit for BARNABY attachments is " + attachment_limit + " so only " + attachment_limit + " of the provided attachments will count.") 
    }
    pointsAwarded = (basePoints + Math.min(uniqueAttachments.size, attachment_limit)) * multiplier;
    // Keep track of barnaby points for perk reasons. Actual points are also recorded further below
    saveData[catcherID]["barnaby_points"] += pointsAwarded;
    saveData[catcherID]["weekly_barnaby_points"] += pointsAwarded;

    // Send the catch AI message for Barnaby catch
    askAI(`User @${catcherUsername} has caught ${uniqueAttachments.size} of a specially abundant type of Pokémon called "BARNABY" Pokémon and received ${pointsAwarded} points! Describe the catch, while playfully ridiculing the caught BARNABY personality, which is: ${saveData[caughtPersonID]["AIPersonality"]}`, catcherID)
      .then(response => sendLongMessage(msg.channel,response));

  } else {

    // Send the catch AI message
    askAI(`User @${catcherUsername} has caught the ${rarity}-rarity Pokémon @${caughtPersonUsername} and received ${pointsAwarded} points! Describe the catch, while playfully ridiculing the caught Pokémon's personality, which is: ${saveData[caughtPersonID]["AIPersonality"]}`, catcherID)
      .then(response => sendLongMessage(msg.channel,response));
  }

  // Add points to the catcher
  saveData[catcherID]["points"] += pointsAwarded;
  saveData[catcherID]["weekly_points"] += pointsAwarded;

  // Deduct half the base points from the caught person (minimum of 1)
  const deduction = Math.max(Math.floor(basePoints / 2), 1);
  // Only deduct TOTAL points
  saveData[caughtPersonID]["points"] -= deduction;

  save(saveData);
}

function handleSpecialPerks(msg, catcherID, caughtPersonID) {
  let multiplier = 1;
  catcherUsername = saveData[String(catcherID)]["username"];
  caughtPersonUsername = saveData[String(caughtPersonID)]["username"];

  // Plot Armor Perk
  if (caughtPersonID === saveData["PLOT_ARMOR_PERSON_ID"]) {
    askAI(`A user (@${catcherUsername}) has tried to 'catch' another user (@${caughtPersonUsername}), but was unsuccessful because of @${caughtPersonUsername}'s special PLOT ARMOR feature.`, catcherID)
      .then(response => sendLongMessage(msg.channel,response));
    saveData["PLOT_ARMOR_PERSON_ID"] = "";
    msg.channel.send(`@${caughtPersonUsername} has used their PLOT ARMOR perk to avoid being caught!`);
    return null; // Return null meaning the catch was unsuccessful
  }

  // Dynamax Perk
  const dynamaxIndex = saveData["DYNAMAX_PEOPLE_ID"].indexOf(catcherID);
  if (dynamaxIndex !== -1) {
    multiplier *= 3;
    // Use up Dynamax Perk
    saveData["DYNAMAX_PEOPLE_ID"][dynamaxIndex] = undefined;
    msg.channel.send(`@${catcherUsername} has used their DYNAMAX perk to triple their points from this catch!`);
  }

  // Vermin Whisperer Perk
  if (caughtPersonID === saveData["VERMIN_WHISPERER_PERSON_ID"]) {
    let deductedPoints = process.env.VERMIN_STEAL_AMOUNT;
    msg.channel.send(`@${catcherUsername} has caught @${caughtPersonUsername}, who has the VERMIN WHISPERER perk, which steals ${deductedPoints} point(s) from @${catcherUsername}'s TOTAL points!`);

    saveData[caughtPersonID]["points"] += deductedPoints;
    saveData[caughtPersonID]["weekly_points"] += deductedPoints;
    // Only deduct from TOTAL points
    saveData[catcherID]["points"] -= deductedPoints;
  }

  // Swiper Perk
  const swiperIndex = saveData["SWIPER_PEOPLE_ID"].indexOf(catcherID);
  if (swiperIndex !== -1) {
    // Use up the Swiper perk
    saveData["SWIPER_PEOPLE_ID"][swiperIndex] = undefined;
    let stolenPoints = Math.max(Math.floor(saveData[caughtPersonID]["points"] * (process.env.SWIPER_STEAL_PERCENTAGE / 100)), 1);
    msg.channel.send(`@${catcherUsername} has used their SWIPER perk to steal ${stolenPoints} (${process.env.SWIPER_STEAL_PERCENTAGE}%) of @${caughtPersonUsername}'s TOTAL points!`);

    saveData[catcherID]["points"] += stolenPoints;
    saveData[catcherID]["weekly_points"] += stolenPoints;
    // Only deduct from TOTAl points
    saveData[caughtPersonID]["points"] -= stolenPoints;
  }

  // Bounty Perk
  if (saveData["BOUNTY_PERSON_ID"] === catcherID) {
    multiplier *= 2;
    msg.channel.send(`${catcher} has the BOUNTY perk, which has doubled their points from this catch!`);
  } else if (saveData["BOUNTY_PERSON_ID"] === caughtPersonID) {
    multiplier *= 2;
    saveData["BOUNTY_PERSON_ID"] = "";
    msg.channel.send(`@${catcherUsername} has caught a Pokémon with the BOUNTY perk, doubling their points! @${caughtPersonUsername} has been caught, removing their BOUNTY perk.`);
  }

  save(saveData);

  return multiplier;
}

// Function to check if a catch is allowed based on cooldowns
function isCatchAllowed(catcherId, caughtId) {
  saveData = load(saveData);
  if (saveData["catchCooldowns"] === undefined){
    saveData["catchCooldowns"] = {};
  }

  const key = `${catcherId}-${caughtId}`;
  const reverseKey = `${caughtId}-${catcherId}`;
  
  const nowInMinutes = Math.ceil(Date.now() / (60 * 1000));
  const cooldownExpiry = saveData["catchCooldowns"][key] || saveData["catchCooldowns"][reverseKey];

  if (!cooldownExpiry){
    return { allowed: true };
  } 
  else if (nowInMinutes < cooldownExpiry) {
    const remainingTimeMinutes = cooldownExpiry - nowInMinutes;
    // Return two data points: That the catch isn't allowed and also how much remaining time until the cooldown is over
    return { allowed: false, remainingTime: remainingTimeMinutes };
  } 
  // Remove the expired cooldown record to keep the database clean
  delete saveData["catchCooldowns"][key];
  delete saveData["catchCooldowns"][reverseKey];
  save(saveData);
  // Return that the catch is allowed
  return { allowed: true };
}

// Function to set a cooldown for a catch
function setCatchCooldown(catcherId, caughtId) {
  const cooldownDurationInMinutes = Number(process.env.COOLDOWN_MINUTES);
  const key = `${catcherId}-${caughtId}`;
  const reverseKey = `${caughtId}-${catcherId}`;
  const nowInMinutes = Math.ceil(Date.now() / (60 * 1000));
  const expiryTime = nowInMinutes + cooldownDurationInMinutes;

  saveData = load(saveData);

  if (saveData["catchCooldowns"] === undefined){
    saveData["catchCooldowns"] = {};
  }
  saveData["catchCooldowns"][key] = expiryTime;
  saveData["catchCooldowns"][reverseKey] = expiryTime;
  save(saveData);
}

function dubPlotArmor(saveData, PLOT_ARMOR_PERSON){
  console.log(PLOT_ARMOR_PERSON);
  saveData["PLOT_ARMOR_PERSON_ID"] = PLOT_ARMOR_PERSON.id;
  console.log(saveData["PLOT_ARMOR_PERSON_ID"]);
  return saveData;
}

function dubDynamax(saveData, DYNAMAX_PERSON) {
    console.log(DYNAMAX_PERSON);
    // Ensure saveData["DYNAMAX_PEOPLE_ID"] is initialized as an array
    if (!Array.isArray(saveData["DYNAMAX_PEOPLE_ID"])) {
      saveData["DYNAMAX_PEOPLE_ID"] = [];
    }
    saveData["DYNAMAX_PEOPLE_ID"].push(DYNAMAX_PERSON.id);
    console.log(saveData["DYNAMAX_PEOPLE_ID"]);
    return saveData;
  }
  

function dubVerminWhisperer(saveData, VERMIN_WHISPERER_PERSON){
  saveData["VERMIN_WHISPERER_PERSON_ID"] = VERMIN_WHISPERER_PERSON.id;
  console.log(saveData["VERMIN_WHISPERER_PERSON_ID"]);
  return saveData;
}

function dubSwiper(saveData, SWIPER_PERSON) {
  // Ensure saveData["DYNAMAX_PEOPLE_ID"] is initialized as an array
  if (!Array.isArray(saveData["DYNAMAX_PEOPLE_ID"])) {
    saveData["DYNAMAX_PEOPLE_ID"] = [];
  }
  saveData["SWIPER_PEOPLE_ID"].push(SWIPER_PERSON.id);
  console.log(saveData["SWIPER_PEOPLE_ID"]);
  return saveData;
}

function dubBounty(saveData, BOUNTY_PERSON){
  saveData["BOUNTY_PERSON_ID"] = BOUNTY_PERSON.id;
  console.log(saveData["BOUNTY_PERSON_ID"]);
  return saveData;
}

async function perkUpdate() {
    try {
      const pokemon_channel = await client.channels.fetch(process.env.POKEMON_CHANNEL_ID);
  
      if (!pokemon_channel) {
        console.error("Pokemon channel not found.");
        return;
      }
  
      saveData = load(saveData);
  
      // Filter and validate user objects
      const users = Object.values(saveData)
        .filter(user => user && typeof user === 'object' && user["wants-to-play"]);
  
      if (users.length === 0) {
        await pokemon_channel.send("No users found");
        return;
      }
  
      // Get the top users for various categories
      const topUsersByPoints = users.sort((a, b) => b["points"] - a["points"]).slice(0, 10);
      const topUsersByBarnabyPoints = users.sort((a, b) => b["barnaby_points"] - a["barnaby_points"]).slice(0, 10);
      const topUsersByWeeklyPoints = users.sort((a, b) => b["weekly_points"] - a["weekly_points"]).slice(0, 5);
      const topUsersByWeeklyBarnabyPoints = users.sort((a, b) => b["weekly_barnaby_points"] - a["weekly_barnaby_points"]).slice(0, 5);
      const topUsersByRarity = users.map(user => ({ ...user, rarity: user["rarity"] || 0 })).sort((a, b) => b["rarity"] - a["rarity"]).slice(0, 5);
  
      // Initialize a string to accumulate the message content
      let messageContent = "";
  
      // Append leaderboard messages
      messageContent += "Here is the overall TOTAL point leaderboard update!:\n" +
        topUsersByPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["points"]}`).join('\n') + "\n\n";
      
      messageContent += "Here is the overall BARNABY point leaderboard!:\n" +
        topUsersByBarnabyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["barnaby_points"]}`).join('\n') + "\n\n";
      
      messageContent += "Here is last week's overall point leaderboard!:\n" +
        topUsersByWeeklyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["weekly_points"]}`).join('\n') + "\n\n";
      
      messageContent += "Here is last week's BARNABY point leaderboard!:\n" +
        topUsersByWeeklyBarnabyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["weekly_barnaby_points"]}`).join('\n') + "\n\n";
      
      messageContent += "Here is last week's RARITY leaderboard!:\n" +
        topUsersByRarity.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["rarity"]}`).join('\n') + "\n\n";
  
      // Plot Armor
      const topWeeklyUser = topUsersByWeeklyPoints[0];
      if (topWeeklyUser) {
        saveData = dubPlotArmor(saveData, topWeeklyUser);
        messageContent += `Winner of the **PLOT ARMOR** perk: *${topWeeklyUser["username"]}*\n\n`;
      }
  
      // Dynamax
      messageContent += "Winners of the **DYNAMAX** perk:\n";
      topUsersByWeeklyPoints.slice(0, 3).forEach((user, index) => {
        console.log("USER: " + user)
        saveData = dubDynamax(saveData, user);
        messageContent += `${index + 1}. ${user["username"]}\n`;
      });
      messageContent += "\n";
  
      // Vermin Whisperer
      const topWeeklyBarnabyUser = topUsersByWeeklyBarnabyPoints[0];
      if (topWeeklyBarnabyUser) {
        saveData = dubVerminWhisperer(saveData, topWeeklyBarnabyUser);
        messageContent += `Winner of the **VERMIN WHISPERER** perk: *${topWeeklyBarnabyUser["username"]}*\n\n`;
      }

  
      // Swiper
      messageContent += "Winners of the **SWIPER** perk:\n";
      topUsersByWeeklyBarnabyPoints.slice(0, 3).forEach((user, index) => {
        saveData = dubSwiper(saveData, user);
        messageContent += `${index + 1}. ${user["username"]}\n`;
      });
      messageContent += "\n";
  
      // Bounty
      const topRarityValues = users.map(user => user["rarity"] || 0);
      let topRarityValue = Math.max(topRarityValues);
      const tiedUsers = users.filter(user => user["rarity"] === topRarityValue);
      if (tiedUsers.length > 0) {
        const bountyWinner = tiedUsers[Math.floor(Math.random() * tiedUsers.length)];
        saveData = dubBounty(saveData, bountyWinner);
        messageContent += `Winner of the **BOUNTY** perk: *${bountyWinner["username"]}*\n\n`;
      }
  
      // Clear weekly points and cooldowns
      users.forEach(user => {
        user["weekly_points"] = 0;
        user["weekly_barnaby_points"] = 0;
      });
      saveData["catchCooldowns"] = {};
  
      // Save all updates
      save(saveData);
  
      // Send the accumulated message content as a single message
      sendLongMessage(pokemon_channel, messageContent);
  
      console.log("Weekly points have been cleared for all players.");
  
    } catch (error) {
      console.error("An error occurred during the tournament update:", error);
    }
  }
  
  
  

// Export all the functions needed
module.exports = {
    express,
    app,
    fs,
    cron,
    openai,
    discord,
    client,
    saveData,
    cmd,
    askAI,
    adjustPoints,
    setRarity,
    increaseRarity,
    sendLongMessage,
    setupDefaultsIfNecessary,
    checkOffLimits,
    load,
    save,
    awardPointsAndSendMessage,
    handleSpecialPerks,
    isCatchAllowed,
    setCatchCooldown,
    perkUpdate
};