// All helper functions for index.js

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

    if (saveData[setRarityPerson.id]["rarity"] === 0 && amount < 0) {
        msg.channel.send(`${setRarityPerson.username}'s rarity value is already at the minimum value of 0.`);
    } else {
        saveData[setRarityPerson.id]["rarity"] = amount;
        msg.channel.send(`Set ${setRarityPerson.username}'s rarity value to ${amount}`);
        save();
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
    saveData[user.id] = {"points": 0, "weekly_points": 0,"barnaby_points": 0,"weekly_barnaby_points": 0,"username":user.username,"pokedex":{},"wants-to-play":true,"rarityValue":0,"AIPersonality":"Pokemon Announcer"};
  }
  save();
}

function checkOffLimits(msg){
  let isOffLimits = false;
  for (let Person of msg.mentions.users) {
    let person = Person[1];
    if (!saveData[person.id] || saveData[person.id]["wants-to-play"] == false){
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

function load(saveData) {
    try {
      saveData = JSON.parse(fs.readFileSync('./save-data.json', 'utf8'));
    } catch (e) {
      saveData = {}; // init if no data found
    }
    return saveData;
}

function save(){
  fs.writeFileSync('./save-data.json', JSON.stringify(saveData));
}

function awardPointsAndSendMessage(msg, catcher, caughtPerson, rarity, basePoints, multiplier) {
  let pointsAwarded = basePoints * multiplier;

  // Check if caughtPerson is a Barnaby catch 
  if (msg.mentions.users.size == 1 && caughtPerson.id === process.env.BARNABY_ID) {
    // Find the amount of unique attachments in the catch message
    const uniqueAttachments = new Set();
    msg.attachments.forEach(attachment => {
      uniqueAttachments.add(attachment.url);
    });
    let attachment_limit = process.env.BARNABY_ATTACHMENT_LIMIT
    if (uniqueAttachments.size > process.env.BARNABY_ATTACHMENT_LIMIT) {
      // Limit the attachments to 10
      msg.channel.send("Sorry! The limit for BARNABY attachments is " + attachment_limit + " so only " + attachment_limit + " of the provided attachments will count.") 
    }
    pointsAwarded = (basePoints + Math.min(uniqueAttachments.size, attachment_limit)) * multiplier;
    // Keep track of barnaby points for perk reasons. Actual points are also recorded further below
    saveData[catcher.id]["barnaby_points"] += pointsAwarded;
    saveData[catcher.id]["weekly_barnaby_points"] += pointsAwarded;

    // Send the catch AI message for Barnaby catch
    askAI(`User @${catcher.username} has caught ${uniqueAttachments.size} of a specially abundant type of Pokémon called "BARNABY" Pokémon and received ${pointsAwarded} points! Describe the catch, while playfully ridiculing the caught BARNABY personality, which is: ${saveData[caughtPerson.id]["AIPersonality"]}`, catcher.id)
      .then(response => sendLongMessage(msg.channel,response));

  } else {

    // Send the catch AI message
    askAI(`User @${catcher.username} has caught the ${rarity}-rarity Pokémon @${caughtPerson.username} and received ${pointsAwarded} points! Describe the catch, while playfully ridiculing the caught Pokémon's personality, which is: ${saveData[caughtPerson.id]["AIPersonality"]}`, catcher.id)
      .then(response => sendLongMessage(msg.channel,response));
  }

  // Add points to the catcher
  saveData[catcher.id]["points"] += pointsAwarded;
  saveData[catcher.id]["weekly_points"] += pointsAwarded;

  // Deduct half the base points from the caught person (minimum of 1)
  const deduction = Math.max(Math.floor(basePoints / 2), 1);
  // Only deduct TOTAL points
  saveData[caughtPerson.id]["points"] -= deduction;
}

function handleSpecialPerks(msg, catcher, caughtPerson) {
  let multiplier = 1;

  // Plot Armor Perk
  if (caughtPerson.id === saveData["PLOT_ARMOR_PERSON_ID"]) {
    askAI(`A user (@${catcher.username}) has tried to 'catch' another user (@${caughtPerson.username}), but was unsuccessful because of @${caughtPerson.username}'s special PLOT ARMOR feature.`, catcher.id)
      .then(response => sendLongMessage(msg.channel,response));
    saveData["PLOT_ARMOR_PERSON_ID"] = "";
    msg.channel.send(`@${caughtPerson.username} has used their PLOT ARMOR perk to avoid being caught!`);
    return null; // Return null meaning the catch was unsuccessful
}

  // Dynamax Perk
  const dynamaxIndex = saveData["DYNAMAX_PEOPLE_ID"].indexOf(catcher.id);
  if (dynamaxIndex !== -1) {
    multiplier *= 3;
    // Use up Dynamax Perk
    saveData["DYNAMAX_PEOPLE_ID"][dynamaxIndex] = undefined;
    msg.channel.send(`@${catcher.username} has used their DYNAMAX perk to triple their points from this catch!`);
  }

  // Vermin Whisperer Perk
  if (caughtPerson.id === saveData["VERMIN_WHISPERER_PERSON_ID"]) {
    let deductedPoints = process.env.VERMIN_STEAL_AMOUNT;
    msg.channel.send(`@${catcher.username} has caught @${caughtPerson.username}, who has the VERMIN WHISPERER perk, which steals ${deductedPoints} point(s) from @${catcher.username}'s TOTAL points!`);

    saveData[caughtPerson.id]["points"] += deductedPoints;
    saveData[caughtPerson.id]["weekly_points"] += deductedPoints;
    // Only deduct from TOTAL points
    saveData[catcher.id]["points"] -= deductedPoints;
  }

  // Swiper Perk
  const swiperIndex = saveData["SWIPER_PEOPLE_ID"].indexOf(catcher.id);
  if (swiperIndex !== -1) {
    // Use up the Swiper perk
    saveData["SWIPER_PEOPLE_ID"][swiperIndex] = undefined;
    let stolenPoints = Math.max(Math.floor(saveData[caughtPerson.id]["points"] * (process.env.SWIPER_STEAL_PERCENTAGE / 100)), 1);
    msg.channel.send(`@${catcher.username} has used their SWIPER perk to steal ${stolenPoints} (${process.env.SWIPER_STEAL_PERCENTAGE}%) of @${caughtPerson.username}'s TOTAL points!`);

    saveData[catcher.id]["points"] += stolenPoints;
    saveData[catcher.id]["weekly_points"] += stolenPoints;
    // Only deduct from TOTAl points
    saveData[caughtPerson.id]["points"] -= stolenPoints;
  }

  // Bounty Perk
  if (saveData["BOUNTY_PERSON_ID"] === catcher.id) {
    multiplier *= 2;
    msg.channel.send(`${catcher} has the BOUNTY perk, which has doubled their points from this catch!`);
  } else if (saveData["BOUNTY_PERSON_ID"] === caughtPerson.id) {
    multiplier *= 2;
    saveData["BOUNTY_PERSON_ID"] = "";
    msg.channel.send(`@${catcher.username} has caught a Pokémon with the BOUNTY perk, doubling their points! @${caughtPerson.username} has been caught, removing their BOUNTY perk.`);
  }

  return multiplier;
}

// Function to check if a catch is allowed based on cooldowns
function isCatchAllowed(catcherId, caughtId) {
  saveData = load(saveData);

  const key = `${catcherId}-${caughtId}`;
  const reverseKey = `${caughtId}-${catcherId}`;
  
  const now = Date.now();
  const cooldownExpiry = saveData["catchCooldowns"][key] || saveData["catchCooldowns"][reverseKey];

  if (cooldownExpiry && now < cooldownExpiry) {
      const remainingTimeMs = cooldownExpiry - now;
      const remainingTimeMinutes = Math.ceil(remainingTimeMs / (1000 * 60)); // Convert milliseconds to minutes
      // Return two data points: That the catch isn't allowed and also how much remaining time until the cooldown is over
      return { allowed: false, remainingTime: remainingTimeMinutes };
  }
  // Return that the catch is allowed
  return { allowed: true };
}

// Function to set a cooldown for a catch
function setCatchCooldown(catcherId, caughtId) {
  const cooldownDuration = 60 * 1000 * process.env.COOLDOWN_MINUTES; // in milliseconds
  const key = `${catcherId}-${caughtId}`;
  const reverseKey = `${caughtId}-${catcherId}`;
  const expiryTime = Date.now() + cooldownDuration;

  saveData = load(saveData);
  if (saveData["catchCooldowns"] === undefined){
    saveData["catchCooldowns"] = {};
  }
  saveData["catchCooldowns"][key] = expiryTime;
  saveData["catchCooldowns"][reverseKey] = expiryTime;
  save();
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

function dubVerminWhisperer(VERMIN_WHISPERER_PERSON){
  saveData["VERMIN_WHISPERER_PERSON_ID"] = VERMIN_WHISPERER_PERSON.id
}

function dubSwiper(SWIPER_PERSON) {
  if (!Array.isArray(saveData["SWIPER_PEOPLE_ID"])) {
      saveData["SWIPER_PEOPLE_ID"] = [];
  }
  if (!saveData["SWIPER_PEOPLE_ID"].includes(SWIPER_PERSON.id)) {
      saveData["SWIPER_PEOPLE_ID"].push(SWIPER_PERSON.id);
  }
}

function dubBounty(BOUNTY_PERSON){
  saveData["BOUNTY_PERSON_ID"] = BOUNTY_PERSON.id
}

async function msgPerkUpdate() {
  try {
      const pokemon_channel = await client.channels.fetch(process.env.POKEMON_CHANNEL_ID);

      if (!pokemon_channel) {
          console.error("Pokemon channel not found.");
          return;
      }

      saveData = load(saveData);

      // Get the top 10 users by overall points
      const topUsersByPoints = Object.values(saveData)
          .filter(user => user["wants-to-play"])
          .sort((a, b) => b["points"] - a["points"])
          .slice(0, 10);
      // Send the overall leaderboard
      await pokemon_channel.send("Here is the overall TOTAL point leaderboard update!:\n" + 
          topUsersByPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["points"]}`).join('\n')
      );

      // Get the top 10 users by barnaby points
      const topUsersByBarnabyPoints = Object.values(saveData)
          .filter(user => user["wants-to-play"])
          .sort((a, b) => b["barnaby_points"] - a["barnaby_points"])  // Sort by barnaby points
          .slice(0, 10);
      // Send the overall barnaby leaderboard
      await pokemon_channel.send("Here is the overall BARNABY point leaderboard!:\n" + 
        topUsersByBarnabyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["barnaby_points"]}`).join('\n')
      );

      // Get the top 5 users by weekly points
      const topUsersByWeeklyPoints = Object.values(saveData)
          .filter(user => user["wants-to-play"])
          .sort((a, b) => b["weekly_points"] - a["weekly_points"])  // Sort by weekly points
          .slice(0, 5);
      // Send the weekly leaderboard
      await pokemon_channel.send("Here is last week\'s overall point leaderboard!:\n" + 
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
        pokemon_channel.send(`🎉 ${user["username"]} was in position ${index + 1} and has been awarded the DYNAMAX perk! 🎉`);
      });

      // Get the top 5 users by weekly barnaby points
      const topUsersByWeeklyBarnabyPoints = Object.values(saveData)
          .filter(user => user["wants-to-play"])
          .sort((a, b) => b["weekly_barnaby_points"] - a["weekly_barnaby_points"])  // Sort by weekly barnaby points
          .slice(0, 5);
      // Send the weekly barnaby leaderboard
      await pokemon_channel.send("Here is last week\'s BARNABY point leaderboard!:\n" + 
        topUsersByWeeklyBarnabyPoints.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["weekly_barnaby_points"]}`).join('\n')
      );
      // Award Vermin Whisperer to the top weekly barnaby user 
      const topWeeklyBarnabyUser = topUsersByWeeklyBarnabyPoints[0];
      if (topWeeklyBarnabyUser){
        await pokemon_channel.send(`🎉 Last week\'s BARNABY winner is **${topWeeklyBarnabyUser["username"]}** with ${topWeeklyBarnabyUser["weekly_barnaby_points"]} points earned by catching BARNABYS, earning the VERMIN WHISPERER perk! 🎉`);
        dubVerminWhisperer(topWeeklyBarnabyUser);
      }
      // Award Swiper perk to the top 3 weekly barnaby users
      topUsersByWeeklyBarnabyPoints.slice(0, 3).forEach((user, index) => {
        dubSwiper(user);
        pokemon_channel.send(`🎉 ${user["username"]} was in position ${index + 1} on last week\'s BARNABY leaderboard and has been awarded the SWIPER perk! 🎉`);
      });

      // Get the top 5 users by rarity
      const topUsersByRarity = Object.values(saveData)
          .filter(user => user["wants-to-play"])
          .map(user => user["rarity"] || 0)
          .slice(0, 5);
      // Send the rarity leaderboard
      await pokemon_channel.send("Here is last week's RARITY leaderboard!:\n" + 
        topUsersByRarity.map((user, index) => `${index + 1}. **${user["username"]}**: ${user["rarity"] || 0}`).join('\n')
      );
      // Award BOUNTY perk to the player with the highest rarity value (in the case of a tie, choose randomly amongst tied players)
      const topRarityValue = Math.max(...Object.values(saveData)
          .filter(user => user["wants-to-play"])
          .map(user => user["rarity"] || 0)
      );
      const tiedUsers = Object.values(saveData)
          .filter(user => user["wants-to-play"] && user["rarity"] === topRarityValue);
      if (tiedUsers.length > 0) {
          const bountyWinner = tiedUsers[Math.floor(Math.random() * tiedUsers.length)];
          await pokemon_channel.send(`🎉 **${bountyWinner["username"]}** was among those with the highest rarity value last week (${topRarityValue}) and has been awarded the BOUNTY perk! 🎉`);
          dubBounty(bountyWinner);
      }

      // Clear all players' weekly points
      Object.values(saveData)
          .filter(user => user["wants-to-play"])
          .forEach(user => {
              user["weekly_points"] = 0;
              user["weekly_barnaby_points"] = 0;
          });
      
      save();

      console.log("Weekly points have been cleared for all players.");

  } catch (error) {
      console.error("An error occurred during the tournament update:", error);
  }
}