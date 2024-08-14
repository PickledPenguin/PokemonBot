const express = require('express')
const app = express()
const fs = require('fs')
var cron = require('node-cron')
require("dotenv").config()

const { OpenAI } = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_TOKEN,
});

var saveData;
var uncommonRole;
var rareRole;
var shinyRole;

try {
  saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8')); // Load save data
} catch (e) {
  console.log("Error with loading saveData:\n" + e)
}

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

// starts the regular updates to pokemon rarity
cron.schedule('00 00 * * *', increaseRarity, {timezone: "America/New_York"});

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

function increaseRarity(){
    console.log("triggering-rarity-increase")
    load(saveData);
    for (let user_id of Object.keys(saveData)) {
        user_id_num = Number(user_id)
        // if the user_id is only numbers
        if (user_id_num != NaN && saveData[user_id]["wants-to-play"] == true){
            
            const currentGuild = client.guilds.cache.find(g => g.id == process.env.GUILD_ID);
            
            currentGuild.members.fetch(user_id).then(member => {

                var uncommonRole = member.guild.roles.cache.find(role => role.name === "Uncommon");
                var rareRole = member.guild.roles.cache.find(role => role.name === "Rare");
                var shinyRole = member.guild.roles.cache.find(role => role.name === "Shiny");

                if (saveData[user_id]["rarityValue"] >= 30){
                    member.roles.add(shinyRole);
                    member.roles.remove(rareRole);
                }
                else if (saveData[user_id]["rarityValue"] >= 14 && saveData[user_id]["rarityValue"] < 30){
                    member.roles.add(rareRole);
                    member.roles.remove(uncommonRole);
                }
                else if (saveData[user_id]["rarityValue"] >= 7 && saveData[user_id]["rarityValue"] < 14){
                    member.roles.add(uncommonRole);
                }
                else if (saveData[user_id]["rarityValue"] < 7) {
                    if (member.roles && member.roles.cache.some(role => role.name === "Uncommon")){
                        member.roles.remove(uncommonRole);
                    }
                    if (member.roles && member.roles.cache.some(role => role.name === "Rare")){
                        member.roles.remove(rareRole);
                    }
                    if (member.roles && member.roles.cache.some(role => role.name === "Shiny")){
                        member.roles.remove(shinyRole);
                    }
                }
                saveData[user_id]["rarityValue"] += 1;
                save();
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

    return chunks
}

function setupDefaultsIfNecessary(user){
  if (saveData[user.id] === undefined) {
    saveData[user.id] = {"points": 0, "weekly_points": 0,"username":user.username,"pokedex":{},"wants-to-play":true,"rarityValue":0,"AIPersonality":"Pokemon Announcer"};
  }
  save();
}

function checkOffLimits(msg){
  let isOffLimits = false;
  for (let Person of msg.mentions.users) {
    let person = Person[1];
    if (saveData[person.id] != undefined){
      if (saveData[person.id]["wants-to-play"] == false){
        isOffLimits = true;
        break;
      }
    }
  }
  if (isOffLimits){
    msg.channel.send("There was someone mentioned in your message that has opted out of playing the game!");
    msg.delete();
    return true;
  }
  return false;
}

function load(saveData) {
    try {
      saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8'));
    } catch (e) {
      saveData = {}; // init if no data found
    }
}

function save(){
  fs.writeFileSync('./save-data.json', JSON.stringify(saveData));
}

client.on('messageCreate', msg => {

  // ignore self messages and other bot messages
  if (msg.author === client.user || msg.author.bot) {
    return;
  }

  if (msg.content.startsWith('!')){
    load(saveData);
  }

  // restrict channels
  if (msg.channelId != 1065049126871515176 && msg.channelId != 1065064038427541594 && msg.channelId != 1053540259717189714){
    return;
  }

  else if (msg.content.toLowerCase().includes('!help-pokemon')){
    msg.channel.send(`
Here are the current commands:

**!help-pokemon**   (Displays these commands)
**!perks**   (Displays all perks, what they do, and how to get them)
**!register**   (Creates a new game record for you if you don't have one already)
**!catch [@people]**   (Catches everyone mentioned)
**!status [@person]**   (Displays point and pokedex status for the person mentioned)
**!leaderboard**   (Displays the top 10 players with the most overall points and weekly points)
**!opt-out**   (Opts you out for playing the game. Any game messages that mention you will be deleted)
**!opt-in**   (Opts you back in for playing the game)
**!off-limits**   (Displays everyone who has opted out of playing the game)
**!set-personality [personality description]**   (Sets the personality of your custom AI catch messages to [personality description])

*The following commands are only available to people with the "PokemonBotManager" tag:*

**!list-data**   (Lists everyone's points and pokedex progress)
**!increment-points [@person]**   (Adds 1 point to the person mentioned)
**!decrement-points [@person]**   (Takes 1 point from the person mentioned)
**!increment-rarity [@person]**   (Increases the rarity value of the person mentioned by 1)
**!decrement-rarity [@person]**   (Decreases the rarity value of the person mentioned by 1)
**!trigger-rarity-increase**   (Triggers an increase in EVERYONE\'S rarity, and assigns appropriate roles based on rarity value. This command automatically runs every day at midnight every day)
**!next-season**   (Advances the game onto the next season. The seasons run in this order: FALL, WINTER, SPRING, SUMMER)
`);
    }

  else if (msg.content.toLowerCase().startsWith('!set-personality')){
    personality = msg.content.substring(16);
    prev_personality = saveData[msg.author.id]["AIPersonality"];
    saveData[msg.author.id]["AIPersonality"] = personality;

    msg.channel.send("Changed personality from **" + prev_personality + "** to **" + personality + "**");

    save();
  }

    
  else if (msg.content.toLowerCase().includes('!register')){
    setupDefaultsIfNecessary(msg.author);
    msg.channel.send(":thumbsup:");
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
        if (saveData[statusPerson.id] != undefined) {
    
          let Pokedex = "{\n";
          for (let pokemon of Object.values(saveData[statusPerson.id]["pokedex"])) {
            Pokedex += "\t" + pokemon + "\n";
          }
          Pokedex += "}"
          
          msg.channel.send("@" + statusPerson.username + " status:\n\n Overall points: " + saveData[statusPerson.id]["points"] + "\nWeekly points: " + saveData[statusPerson.id]["weekly_points"] + "\nPokedex: \n" + Pokedex);
        }
          
        else {
          msg.channel.send("@" + statusPerson.username + " has 0 pokemon points and no pokedex");
        }
      } catch (e) {
        // if no status found for author
        msg.channel.send("No status found for " + statusPerson.username);
      }
    }
  }


  else if (msg.content.toLowerCase().includes('!opt-out')){
    setupDefaultsIfNecessary(msg.author);
    saveData[msg.author.id]["wants-to-play"] = false;
    msg.channel.send("Successfully opted out for playing the game. Any game messages that mention you will be deleted")
    save();
  }

  else if (msg.content.toLowerCase().includes('!opt-in')){
    setupDefaultsIfNecessary(msg.author);
    saveData[msg.author.id]["wants-to-play"] = true;
    msg.channel.send("Successfully opted in to playing the game. Happy hunting :grin:");
    save();
  }

  else if (msg.content.toLowerCase().includes('!off-limits')){
    result = "Here are all the people who does NOT want to be involved in the game:\n\n"
    for (let key of Object.keys(saveData)) {
      if (!saveData[key]["wants-to-play"]){
        result += "\t**" + saveData[key]["username"] + "**\n";
      }
    }
    result += "\nAny \"!catch\" messages that mention these people will be deleted";
    msg.channel.send(result);
  }


  // if message includes "!catch"
  else if (msg.content.toLowerCase().includes('!catch')) {

    if (checkOffLimits(msg)){
      return;
    }
    for (let CaughtPerson of msg.mentions.users) {
      let caughtPerson = CaughtPerson[1];

      if (msg.author.id === caughtPerson.id) {
        askAI("A user has tried to \"catch\" themselves. Ridicule them for attempting such a rediculous thing", msg.author.id)
        .then(async response => {
            msg.channel.send(response);
        });
      }
      else if (caughtPerson.id === saveData["PLOT_ARMOR_PERSON_ID"]){
        askAI("A user has tried to \"catch\" another user, but was unsuccessful because of the other user's special PLOT ARMOR feature.", msg.author.id)
        .then(async response => {
            msg.channel.send(response);
        });
        saveData["PLOT_ARMOR_PERSON_ID"] = "";
        msg.channel.send(caughtPerson + " has used their PLOT ARMOR perk to avoid being caught!");
      }
      else if (caughtPerson.id === process.env.BOT){
        askAI("A user has tried to \"catch\" YOU and was obviously unsuccessul! Ridicule them for attempting such a rediculous thing", msg.author.id)
        .then(async response => {
            msg.channel.send(response);
        });
      }
        
      else {
        setupDefaultsIfNecessary(msg.author);
        setupDefaultsIfNecessary(caughtPerson);
          
        const currentGuild = client.guilds.cache.find(g => g.id == process.env.GUILD_ID);
        currentGuild.members.fetch(caughtPerson.id).then(person => {
            
            var multiplier = 1;
            const dynamaxIndex = saveData["DYNAMAX_PEOPLE_ID"].indexOf(msg.author.id);
            
            if (dynamaxIndex !== -1) {
              multiplier *= 3;
              saveData["DYNAMAX_PEOPLE_ID"][dynamaxIndex] = undefined;
              msg.channel.send(`${msg.author} has used their DYNAMAX perk to triple their points from this catch!`);
            }
            
            if (saveData["BOUNTY_PERSON_ID"] == msg.author.id){
              multiplier *= 2;
              msg.channel.send(msg.author + " has the BOUNTY perk, which has doubled their points from this catch!");
            }
            else if (saveData["BOUNTY_PERSON_ID"] == caughtPerson.id){
              multiplier *= 2;
              saveData["BOUNTY_PERSON_ID"] = "";
              msg.channel.send(msg.author + " has caught a pokemon with the BOUNTY perk, which has doubled their points from this catch!\n\n" + caughtPerson + " has been caught, removing their BOUNTY perk");
            }

            if (!person.roles){
                var points_awarded = multiplier;
                saveData[msg.author.id]["points"] += points_awarded;
                saveData[msg.author.id]["weekly_points"] += points_awarded;
                askAI("The User @" + msg.author.username + " has caught the NORMAL-rarity Pokemon " + "@" + caughtPerson.username + " and has recieved " + points_awarded + " point. Describe the catch, while playfully ridiculing the caught Pokemon's personality, which is: " + saveData[caughtPerson.id]["AIPersonality"], msg.author.id)
                .then(async response => {
                    msg.channel.send(response);
                });
                saveData[caughtPerson.id]["points"] -= 1;
                saveData[caughtPerson.id]["weekly_points"] -= 1;
            }
            else if (person.roles.cache.some(role => role.name === "Uncommon")){
                var points_awarded = 3 * multiplier;
                saveData[msg.author.id]["points"] += points_awarded;
                saveData[msg.author.id]["weekly_points"] += points_awarded;
                askAI("User @" + msg.author.username + " has caught the UNCOMMON-rarity Pokemon " + "@" + caughtPerson.username + " and has received " + points_awarded + " points. Describe the catch, while playfully ridiculing the caught Pokemon's personality, which is: " + saveData[caughtPerson.id]["AIPersonality"], msg.author.id)
                .then(async response => {
                    msg.channel.send(response);
                });
                saveData[caughtPerson.id]["points"] -= 2;
                saveData[caughtPerson.id]["weekly_points"] -= 2;
            }
            else if (person.roles.cache.some(role => role.name === "Rare")){
                var points_awarded = 5 * multiplier;
                saveData[msg.author.id]["points"] += points_awarded;
                saveData[msg.author.id]["weekly_points"] += points_awarded;
                askAI("User @" + msg.author.username + " has caught the RARE-rarity Pokemon " + "@" + caughtPerson.username + " and has recieved " + points_awarded + " points! Describe the catch, while playfully ridiculing the caught Pokemon's personality, which is: " + saveData[caughtPerson.id]["AIPersonality"], msg.author.id)
                .then(async response => {
                    msg.channel.send(response);
                });
                saveData[caughtPerson.id]["points"] -= 3;
                saveData[caughtPerson.id]["weekly_points"] -= 3;
            }
            else if (person.roles.cache.some(role => role.name === "Shiny")){
                var points_awarded = 10 * multiplier;
                saveData[msg.author.id]["points"] += points_awarded;
                saveData[msg.author.id]["weekly_points"] += points_awarded;
                askAI("User @" + msg.author.username + " HAS CAUGHT THE SHINY-rarity POKEMON " + "@" + caughtPerson.username + " AND HAS RECIEVED " + points_awarded + " POINTS! Describe the catch, while playfully ridiculing the caught Pokemon's personality, which is: " + saveData[caughtPerson.id]["AIPersonality"], msg.author.id)
                .then(async response => {
                    msg.channel.send(response);
                });
                saveData[caughtPerson.id]["points"] -= 5;
                saveData[caughtPerson.id]["weekly_points"] -= 5;
            }
            else{
                var points_awarded = multiplier;
                saveData[msg.author.id]["points"] += points_awarded;
                saveData[msg.author.id]["weekly_points"] += points_awarded;
                askAI("User @" + msg.author.username + " has caught the NORMAL-rarity Pokemon " + "@" + caughtPerson.username + " and has recieved " + points_awarded + " point. Describe the catch, while playfully ridiculing the caught Pokemon's personality, which is: " + saveData[caughtPerson.id]["AIPersonality"], msg.author.id)
                .then(async response => {
                    msg.channel.send(response);
                });;
                saveData[caughtPerson.id]["points"] -= 1;
                saveData[caughtPerson.id]["weekly_points"] -= 1;
            }
            
            saveData[msg.author.id]["pokedex"][caughtPerson.id + saveData["SEASON_ID"]] = saveData["SEASON_EMOJI"] + " " + caughtPerson.username + " " + saveData["SEASON_EMOJI"];
            saveData[caughtPerson.id]["rarityValue"] = 0;
            save();
        }).catch(error => console.log(error));
      }
    }
  }

  else if (msg.content.toLowerCase().includes("!leaderboard")) {
    
    load(saveData);

        // Get the top 10 users by overall points
        const topUsersByPoints = Object.values(saveData)
            .filter(user => user["wants-to-play"])
            .sort((a, b) => b["points"] - a["points"])
            .slice(0, 10);

        // Send the overall leaderboard
        msg.channel.send("Overall point leaderboard:\n" + 
            topUsersByPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["points"]}`).join('\n')
        );

        // Get the top 10 users by weekly points
        const topUsersByWeeklyPoints = Object.values(saveData)
            .filter(user => user["wants-to-play"])
            .sort((a, b) => b["weekly_points"] - a["weekly_points"])  // Sort by weekly points
            .slice(0, 10);

        // Send the weekly leaderboard
        msg.channel.send("Weekly point leaderboard:\n" + 
            topUsersByWeeklyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["weekly_points"]}`).join('\n')
        );
  }


  else if (msg.content.toLowerCase().includes("!list-data")) {
    load(saveData);

    if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {

      let result = "Listing all data:\n\n";
      for (let key of Object.keys(saveData)){
        if (saveData[key]["wants-to-play"] == true){
          result = result + "**" + saveData[key]["username"] + ":**\n\t*Points:* " + saveData[key]["points"] + "\n\t*Pokedex Completion:* " + Object.keys(saveData[key]["pokedex"]).length + "\n\n";
        }
      }
      const messageChunks = splitMessage(result, 2000)

      for (chunk of messageChunks) {
        msg.channel.send(chunk);
      }
    }
    else {
      msg.channel.send("You are not a PokemonBotManager :eyes:");
    }
  }
    

  else if (msg.content.toLowerCase().includes("!increment-points")){

    const incrementPerson = msg.mentions.users.first()
    
    if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {

        if (checkOffLimits(msg)){
          return;
        }
          
        else if (!incrementPerson) {
          msg.channel.send("No user mentioned, please specify a person");
        }
        else{
          if (saveData[incrementPerson.id]["points"] === undefined) {
            saveData[incrementPerson.id]["points"] = 1;
            saveData[incrementPerson.id]["weekly_points"] = 1;
            saveData[incrementPerson.id]["username"] = incrementPerson.username
          }
          else if (saveData[incrementPerson.id]["weekly_points"] === undefined){
            saveData[incrementPerson.id]["weekly_points"] = 1;
            saveData[incrementPerson.id]["username"] = incrementPerson.username
          }
          else {
            saveData[incrementPerson.id]["points"] += 1
            saveData[incrementPerson.id]["weekly_points"] += 1;
          }
          save();
          msg.channel.send("Added 1 point to " + incrementPerson.username + "\'s pokemon points")
        }
      }
      else {
        msg.channel.send("You are not a PokemonBotManager :eyes:");
      }
  }

  else if (msg.content.toLowerCase().includes("!decrement-points")){

    const decrementPerson = msg.mentions.users.first()

    if (checkOffLimits(msg)){
      return;
    }
    
    else if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {
        
        if (!checkOffLimits(msg)){
          return;
        }
      
        else if (!decrementPerson) {
          msg.channel.send("No user mentioned, please specify a person");
        }
        else{
          if (saveData[decrementPerson.id]["points"] === undefined) {
            saveData[decrementPerson.id]["points"] = -1;
            saveData[incrementPerson.id]["weekly_points"] = -1;
            saveData[decrementPerson.id]["username"] = decrementPerson.username
          }
          else if (saveData[incrementPerson.id]["weekly_points"] === undefined){
            saveData[incrementPerson.id]["weekly_points"] = -1;
            saveData[decrementPerson.id]["username"] = decrementPerson.username
          }
          else {
            saveData[decrementPerson.id]["points"] -= 1
            saveData[incrementPerson.id]["weekly_points"] -= 1;
          }
          save();
          msg.channel.send("Took 1 point from " + decrementPerson.username + "\'s pokemon points")
        }
      }
      else {
        msg.channel.send("You are not a PokemonBotManager :eyes:");
      }
  }
    
  else if (msg.content.toLowerCase().includes("!decrement-rarity")){
      const incrementPerson = msg.mentions.users.first()
    
    if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {

        if (checkOffLimits(msg)){
          return;
        }
          
        else if (!incrementPerson) {
          msg.channel.send("No user mentioned, please specify a person");
        }
        else{
          if (saveData[incrementPerson.id]["rarityValue"] === undefined) {
            saveData[incrementPerson.id]["rarityValue"] = 0;
            saveData[incrementPerson.id]["username"] = incrementPerson.username
          }
          else {
            if (saveData[incrementPerson.id]["rarityValue"] != 0){
            	saveData[incrementPerson.id]["rarityValue"] -= 1
            }
          }
          save();
          msg.channel.send("Decremented " + incrementPerson.username + "\'s rarity by 1, for a total rarity value of " + saveData[incrementPerson.id]["rarityValue"])
        }
      }
      else {
        msg.channel.send("You are not a PokemonBotManager :eyes:");
      }
  }
    
    
  else if (msg.content.toLowerCase().includes("!increment-rarity")){
      const incrementPerson = msg.mentions.users.first()
    
    if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {

        if (checkOffLimits(msg)){
          return;
        }
          
        else if (!incrementPerson) {
          msg.channel.send("No user mentioned, please specify a person");
        }
        else{
          if (saveData[incrementPerson.id]["rarityValue"] === undefined) {
            saveData[incrementPerson.id]["rarityValue"] = 1;
            saveData[incrementPerson.id]["username"] = incrementPerson.username
          }
          else {
            saveData[incrementPerson.id]["rarityValue"] += 1
          }
          save();
          msg.channel.send("Increased " + incrementPerson.username + "\'s rarity by 1, for a total rarity value of " + saveData[incrementPerson.id]["rarityValue"])
        }
      }
      else {
        msg.channel.send("You are not a PokemonBotManager :eyes:");
      }
  }

  else if (msg.content.toLowerCase().includes("!next-season")){
    
    if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {

      load(saveData);

      if (!saveData["SEASON_ID"] || saveData["SEASON_ID"] == "SUMMER"){
        saveData["SEASON_ID"] = "FALL";
        saveData["SEASON_EMOJI"] = ":fallen_leaf:";
      }
      else if (saveData["SEASON_ID"] == "FALL"){
        saveData["SEASON_ID"] = "WINTER";
        saveData["SEASON_EMOJI"] = ":snowflake:";
      }
      else if (saveData["SEASON_ID"] == "WINTER"){
        saveData["SEASON_ID"] = "SPRING";
        saveData["SEASON_EMOJI"] = ":herb:";
      }
      else if (saveData["SEASON_ID"] == "SPRING"){
        saveData["SEASON_ID"] = "SUMMER";
        saveData["SEASON_EMOJI"] = ":sunny:";
      }

      save();

      msg.channel.send("Welcome to the next season! The season ID is: " + saveData["SEASON_ID"] + " and the season emoji is: " + saveData["SEASON_EMOJI"]);
    }
    else{
      msg.channel.send("You are not a PokemonBotManager :eyes:");
    }
  }
  else if (msg.content.toLowerCase().includes("!trigger-rarity-increase")){
      increaseRarity();
  }



  // Tournament ADDONS

  else if (msg.content.toLowerCase().includes("!perks")) {
    msg.channel.send(`
Here are the current perks and how to earn them! Perks are awarded at the start of each week.

**PLOT ARMOR**: 
- Awarded to the #1 player on the previous week\'s leaderboard
- This perk will block the next attempt to catch you!
- One time use

**DYNAMAX**
- Awarded to the top 3 players on the previous week\'s leaderboard
- This perk triples the points of the next catch you make!
- One time use

**BOUNTY**
- Awarded to the player with the highest rarity (Must be Rare or higher to be eligible). If there is a tie, one player is randomly chosen among the tied players.
- This perk doubles the points of ALL catches you make while you have it!
- If you are caught, the points given to your catcher are doubled and the perk is removed

`);
  }

  function dubPlotArmor(PLOT_ARMOR_PERSON){
    saveData["PLOT_ARMOR_PERSON_ID"] = PLOT_ARMOR_PERSON.id
  }

  function dubDynamax(DYNAMAX_PERSON) {

    if (!Array.isArray(saveData["DYNAMAX_PEOPLE_ID"])) {
        saveData["DYNAMAX_PEOPLE_ID"] = [];
    }

    if (!saveData["DYNAMAX_PEOPLE_ID"].includes(DYNAMAX_PERSON.id)) {
        saveData["DYNAMAX_PEOPLE_ID"].push(DYNAMAX_PERSON.id);
    }
}

  function dubBounty(BOUNTY_PERSON){
    saveData["BOUNTY_PERSON_ID"] = BOUNTY_PERSON.id
  }

  async function msgTournamentUpdate() {
    try {
        const pokemon_channel = await client.channels.fetch(process.env.POKEMON_CHANNEL_ID);
        if (!pokemon_channel) {
            console.error("Pokemon channel not found.");
            return;
        }

        load(saveData);

        // Get the top 10 users by overall points
        const topUsersByPoints = Object.values(saveData)
            .filter(user => user["wants-to-play"])
            .sort((a, b) => b["points"] - a["points"])
            .slice(0, 10);

        // Send the overall leaderboard
        await pokemon_channel.send("Here is the overall point leaderboard update!:\n" + 
            topUsersByPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["points"]}`).join('\n')
        );

        // Get the top 10 users by weekly points
        const topUsersByWeeklyPoints = Object.values(saveData)
            .filter(user => user["wants-to-play"])
            .sort((a, b) => b["weekly_points"] - a["weekly_points"])  // Sort by weekly points
            .slice(0, 10);

        // Send the weekly leaderboard
        await pokemon_channel.send("Here is last week\'s point leaderboard!:\n" + 
            topUsersByWeeklyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["weekly_points"]}`).join('\n')
        );

        // Award Plot Armor to the top weekly user
        const topWeeklyUser = topUsersByWeeklyPoints[0];
        if (topWeeklyUser) {
            await pokemon_channel.send(`🎉 Last week\'s winner is **${topWeeklyUser["username"]}** with ${topWeeklyUser["weekly_points"]} points, earning the PLOT ARMOR perk! 🎉`);
            dubPlotArmor(topWeeklyUser);
        }

        // Award Dynamax perk to the top 3 weekly users
        topUsersByWeeklyPoints.slice(0, 3).forEach((user, index) => {
            dubDynamax(user);
            pokemon_channel.send(`🎉 ${user["username"]} was in position ${index + 1} on last week\'s leaderboard and has been awarded the DYNAMAX perk! 🎉`);
        });

        // Award BOUNTY perk to the player with the highest rarity value
        const topRarityValue = Math.max(...Object.values(saveData)
            .filter(user => user["wants-to-play"])
            .map(user => user["rarity"] || 0)
        );

        const tiedUsers = Object.values(saveData)
            .filter(user => user["wants-to-play"] && user["rarity"] === topRarityValue);

        if (tiedUsers.length > 0) {
            const bountyWinner = tiedUsers[Math.floor(Math.random() * tiedUsers.length)];
            await pokemon_channel.send(`🏆 **${bountyWinner["username"]}** is among those with the highest rarity value (${topRarityValue}) and is awarded the BOUNTY perk! 🏆`);
            dubBounty(bountyWinner);
        }

        // Clear all players' weekly points
        Object.values(saveData)
            .filter(user => user["wants-to-play"])
            .forEach(user => {
                user["weekly_points"] = 0;
            });
        
        save();

        console.log("Weekly points have been cleared for all players.");

    } catch (error) {
        console.error("An error occurred during the tournament update:", error);
    }
  }


})

client.login(process.env.TOKEN);