const express = require('express')
const app = express()
const fs = require('fs')
var cron = require('node-cron')
require("dotenv").config()

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPEN_AI_TOKEN,
});
const openai = new OpenAIApi(configuration);

var saveData;
var uncommonRole;
var rareRole;
var shinyRole;

try {
  saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8')); // Load save data
} catch (e) {
  console.log("Error with loading saveData")
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
cron.schedule('50 21 * * *', increaseRarity, {timezone: "America/New_York"});

async function askAI(prompt, author_id){
    const response = await openai.chat.completions.create({
        messages: [{role: "system", content: "You are an announcer in an online Pokemon-like game where several users attempt to \"catch\" various Pokemon and obtain points based on the rarity value of the Pokemon they catch, as well as add those Pokemon to their \"Pokedex\". Your personality and tone for all following prompt answers should be: " + saveData[author_id]["AIPersonality"]}, { role: "user", content: prompt }],
        model: "gpt-3.5-turbo",
      });
    return response.choices[0];
}

function increaseRarity(){
    load(saveData);
    console.log(saveData);
    for (let user_id of Object.keys(saveData)) {
        console.log(user_id)
        user_id_num = Number(user_id)
        // if the user_id is only numbers
        if (user_id_num != NaN && saveData[user_id]["wants-to-play"] == true){
            
            const currentGuild = client.guilds.cache.find(g => g.id == process.env.GUILD_ID);
            const uncommonRole = currentGuild.roles.cache.get(process.env.UNCOMMON_ROLE);
            const rareRole = currentGuild.roles.cache.get(process.env.RARE_ROLE);
            const shinyRole = currentGuild.roles.cache.get(process.env.SHINY_ROLE);
            
            currentGuild.members.fetch(user_id).then(member => {
                
                console.log(member.name);
                if (saveData[user_id]["rarityValue"] == 30){
                    member.roles.add(shinyRole);
                    member.roles.remove(rareRole);
                }
                else if (saveData[user_id]["rarityValue"] == 14){
                    member.roles.add(rareRole);
                    member.roles.remove(uncommonRole);
                }
                else if (saveData[user_id]["rarityValue"] == 7){
                    member.roles.add(uncommonRole);
                }
                else if (saveData[user_id]["rarityValue"] < 7) {
                    if (member.roles && member.roles.cache.has(uncommonRole.id)){
                        member.roles.remove(uncommonRole);
                    }
                }
                console.log(saveData[user_id]["rarityValue"])
                saveData[user_id]["rarityValue"] += 1;
                save();
                console.log(saveData[user_id]["rarityValue"])
            }).catch(error => console.log(error));
        }
    }
    load();
    console.log(saveData)
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
    saveData[user.id] = {"points": 0,"username":user.username,"pokedex":{},"wants-to-play":true,"rarityValue":0,"AIPersonality":"Pokemon Announcer"};
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

  // restrict channels
  else if (msg.channelId != 1065049126871515176 && msg.channelId != 1065064038427541594 && msg.channelId != 1053540259717189714){
    return;
  }

  if (msg.content.startsWith('!')){
    load(saveData);
  }

  else if (msg.content.toLowerCase().includes('!help-pokemon')){
    msg.channel.send("Here are the current commands:\n\n**!help-pokemon**   (displays commands)\n**!register**   (Creates a new game record for you if you don\'t have one already)\n**!catch [@people]**   (catches everyone mentioned)\n**!uncatch [@people]**   (reverts catches on everyone mentioned)\n**!status [@person]**   (gives point and pokedex status for the person mentioned)\n**!leaderboard**   (Gives the top 10 players with the most points)\n**!list-data**   (Lists everyone's points and pokedex progress)\n**!opt-out**   (Opts you out for playing the game. Any game messages that mention you will be deleted)\n**!opt-in**   (Opts you back in for playing the game)\n**!off-limits**   (Displays everyone who has opted out of playing the game)\n\n*The following commands are only availible to people with the \"PokemonBotManager\" tag:*\n\n**!clear-all-data**   (Erases all data. THIS CANNOT BE UNDONE!)\n**!increment-points [@person]**   (adds 1 point to the person mentioned)\n**!decrement-points [@person]**   (takes 1 point from the person mentioned)\n**!increment-rarity [@person]**   (increases the rarity value of the person mentioned by 1)\n**!decrement-rarity [@person]**   (decreases the rarity value of the person mentioned by 1)\n**!next-season**   (advances the game onto the next season. The seasons run in this order: FALL, WINTER, SPRING, SUMMER)")
  }

  else if (msg.content.toLowerCase().startsWith('!set-personality')){
    personality = msg.content.split('!set-personality', 1)[1]
    saveData[msg.author.id]["AIPersonality"] = personality;
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
          
          msg.channel.send("@" + statusPerson.username + " status:\n\nPokemon points: " + saveData[statusPerson.id]["points"] + "\nPokedex: \n" + Pokedex);
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
        msg.channel.send(askAI("A user has tried to \"catch\" themselves. Ridicule them for attempting such a rediculous thing", msg.author.id));
      }
      else if (caughtPerson.id === process.env.PLOT_ARMOR_PERSON){
        msg.channel.send(askAI("A user has tried to \"catch\" another user, but was unsuccessful because of the other user's special PLOT ARMOR feature.", msg.author.id))
      }
      else if (caughtPerson.id === process.env.BOT){
        msg.channel.send(askAI("A user has tried to \"catch\" YOU and was obviously unsuccessul! Ridicule them for attempting such a rediculous thing", msg.author.id));
      }
        
      else {
        setupDefaultsIfNecessary(msg.author);
        setupDefaultsIfNecessary(caughtPerson);
          
        const currentGuild = client.guilds.cache.find(g => g.id == process.env.GUILD_ID);
        currentGuild.members.fetch(caughtPerson.id).then(person => {
            
            if (!person.roles){
                saveData[msg.author.id]["points"] += 1;
                msg.channel.send(askAI("User @" + msg.author.username + " has caught the NORMAL-rarity Pokemon " + "@" + caughtPerson.username + " and has recieved 1 point. Describe the catch!", msg.author.id));
            }
            else if (person.roles.cache.some(role => role.id === process.env.UNCOMMON_ROLE)){
                saveData[msg.author.id]["points"] += 3;
                msg.channel.send(askAI("User @" + msg.author.username + " has caught the UNCOMMON-rarity Pokemon " + "@" + caughtPerson.username + " and has received 3 points. Describe the catch!", msg.author.id));
            }
            else if (person.roles.cache.some(role => role.id === process.env.RARE_ROLE)){
                saveData[msg.author.id]["points"] += 5;
                msg.channel.send(askAI("User @" + msg.author.username + " has caught the RARE-rarity Pokemon " + "@" + caughtPerson.username + " and has recieved 5 points! Describe the catch!"), msg.author.id)
            }
            else if (person.roles.cache.some(role => role.id === process.env.SHINY_ROLE)){
                saveData[msg.author.id]["points"] += 10;
                msg.channel.send("User @" + msg.author.username + " HAS CAUGHT THE SHINY-rarity POKEMON " + "@" + caughtPerson.username + " AND HAS RECIEVED 10 POINTS! Describe the catch!")
            }
            else{
                saveData[msg.author.id]["points"] += 1;
                msg.channel.send(askAI("User @" + msg.author.username + " has caught the NORMAL-rarity Pokemon " + "@" + caughtPerson.username + " and has recieved 1 point. Describe the catch!", msg.author.id));
            }
            
            saveData[msg.author.id]["pokedex"][caughtPerson.id + saveData["SEASON_ID"]] = saveData["SEASON_EMOJI"] + " " + caughtPerson.username + " " + saveData["SEASON_EMOJI"];
        	saveData[caughtPerson.id]["points"] -= 1;
            saveData[caughtPerson.id]["rarityValue"] = 0;
            save();
        }).catch(error => console.log(error));
      }
    }
  }


  else if (msg.content.toLowerCase().includes("!uncatch")) {

    if (checkOffLimits(msg)){
      return;
    }
    else {
      for (let undoCaughtPerson of msg.mentions.users) {
  
        let uncatchPerson = undoCaughtPerson[1];
  
        if (msg.author.id === uncatchPerson.id) {
          msg.channel.send("You can\'t uncatch yourself LOL :joy:")
        }
  
        else if (uncatchPerson.id === process.env.BOT){
          msg.channel.send("Bro tried to uncatch me :skull: :skull: :skull:");
        }
          
        else {
          setupDefaultsIfNecessary(msg.author);
          setupDefaultsIfNecessary(uncatchPerson);
            
          const currentGuild = client.guilds.cache.find(g => g.id == process.env.GUILD_ID);
          currentGuild.members.fetch(uncatchPerson.id).then(person => {
            
            if (!person.roles){
                saveData[msg.author.id]["points"] -= 1;
            }
            else if (person.roles.cache.some(role => role.id === process.env.UNCOMMON_ROLE)){
                saveData[msg.author.id]["points"] -= 3;
            }
            else if (person.roles.cache.some(role => role.id === process.env.RARE_ROLE)){
                saveData[msg.author.id]["points"] -= 5;
            }
            else if (person.roles.cache.some(role => role.id === process.env.SHINY_ROLE)){
                saveData[msg.author.id]["points"] -= 10;
            }
            else{
                saveData[msg.author.id]["points"] -= 1;
            }
            
            msg.channel.send("@" + msg.author.username + "has uncaught " + "@" + uncatchPerson.username)
            
            saveData[msg.author.id]["pokedex"][uncatchPerson.id + saveData["SEASON_ID"]] = saveData["SEASON_EMOJI"] + " " + uncatchPerson.username + " " + saveData["SEASON_EMOJI"];
            saveData[uncatchPerson.id]["points"] += 1;
            save();
        }).catch(error => console.log(error));

          // below is the code to delete the entry into the pokedex, in case we need it
          
          //if (saveData[msg.author.id]["pokedex"][uncatchPerson.id + saveData['SEASON_ID']] != undefined){
            //delete saveData[msg.author.id]["pokedex"][uncatchPerson.id];
          //}
  
          saveData[uncatchPerson.id]["points"] += 1;
  
          save();
        }
      }
    }
  }


  else if (msg.content.toLowerCase().includes("!leaderboard")) {
    
    load(saveData);
    let topUsersByPoints = Object.values(saveData)
    .filter(user => user["wants-to-play"])
    .sort((a, b) => b["points"] - a["points"])
    .slice(0, 10);

    msg.channel.send("Top 10 users with the most points:\n", topUsersByPoints.map((user, index) =>
    `${index + 1}. Username: ${user["username"]}, Points: ${user["points"]}`
  ).join('\n'));

  }


  else if (msg.content.toLowerCase().includes("!list-data")) {
    load(saveData)
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

  else if (msg.content.toLowerCase().includes("!clear-all-data")) {

    if (msg.member.roles.cache.some(role => role.name === 'PokemonBotManager') || msg.author.id === process.env.AUTHOR_ID) {
      // clear all data
      saveData = {};
      save()
      msg.channel.send("All data cleared")
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
            saveData[incrementPerson.id]["username"] = incrementPerson.username
          }
          else {
            saveData[incrementPerson.id]["points"] += 1
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
            saveData[decrementPerson.id]["username"] = decrementPerson.username
          }
          else {
            saveData[decrementPerson.id]["points"] -= 1
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
  else if (msg.content.toLowerCase().includes("!increase-rarity")){
      increaseRarity();
      console.log("increasing rarity")
  }

})

client.login(process.env.TOKEN);