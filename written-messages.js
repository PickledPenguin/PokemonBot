const HELP_POKEMON = `
Welcome to the Pokemon game! For a full list of all commands, type "!help-commands".
(First time? Type "!register" to join the game.)

Catch fellow players by posting a picture of them in the POKEMON channel and using "!catch" with their mention (@Username). If multiple players are in one picture, mention them all to catch everyone. Points are awarded based on the rarity of the person you catch. Everyone's rarity increases every day that they are not caught, earning roles like UNCOMMON, RARE, and SHINY.

You can also catch "Pokémon-like" animals (or statues) by using "!catch" with "@barnaby" as the mention. You can send up to ${process.env.BARNABY_ATTACHMENT_LIMIT} unique pictures per message and will recieve points for each one. No duplicate pictures are allowed!

After a catch, both you and the person caught will be on a ${process.env.COOLDOWN_MINUTES}-minute cooldown, preventing further catches between you two during that time.

Each week, top players earn special PERKS. Type "!help-perks" to learn more! Use "!status @username" to check a player's status or "!leaderboard" for the overall top 10 players.

Finally, after a "!catch", you'll receive a fun AI-generated message based on your AI-personality and that of the person you caught! The default personality is "Pokemon Announcer," but you can change it with "!set-personality" and get creative!
`;


const HELP_COMMANDS =
`
Here are the current commands:

**!help-commands**   (Displays these commands)
**!help-pokemon**   (Gives a brief overview on how to play the game)
**!help-perks**   (Displays all perks, what they do, and how to earn them)
**!register**   (Creates a new game record if you don't have one already)
**!catch [@players]**   (Catches all players mentioned, from first mentioned to last mentioned)
**!status [@player]**   (Displays the Points, Pokedex, and Perk of the player mentioned)
**!leaderboard**   (Displays the top 10 players with the most overall points and most overall BARNABY points)
**!opt-out**   (Opts you out for playing the game. Any game messages that mention you will be deleted)
**!opt-in**   (Opts you back in for playing the game)
**!off-limits**   (Displays everyone who has opted out of playing the game)
**!set-personality [personality description]**   (Sets the personality of your custom AI catch messages to [personality description])

*The following commands are only available to people with the "PokemonBotManager" tag:*

**!add-points [@person] [amount]**   (Adds [amount] points to the person mentioned)
**!subtract-points [@person] [amount]**   (Subtracts [amount] point from the person mentioned)
**!get-rarity [@person]**   (Displays the rarity value of the person mentioned)
**!set-rarity [@person] [amount]**   (Sets the rarity value of the person mentioned to [amount])
**!next-season**   (Advances the game onto the next season. The seasons run in this order: FALL, WINTER, SPRING, SUMMER)
**!trigger-rarity-increase**   (Triggers an increase in EVERYONE'S rarity, and assigns appropriate roles based on rarity value. This command automatically runs at midnight every day)
**!trigger-perk-update**   (Triggers the perk update. This command automatically runs at noon at the start of every week)

`;

const HELP_PERKS = 
`
Here are the current perks and how to earn them! Perks are awarded at the start of each week.
All perk benefits stack.

**PLOT ARMOR**: 
- Awarded to the #1 player on the previous week's leaderboard
- This perk will block the next attempt to catch you!
- One time use

**DYNAMAX**
- Awarded to the top 3 players on the previous week's leaderboard
- This perk triples the points of the next catch you make!
- One time use

**VERMIN WHISPERER**
- Awarded to the #1 player on the previous week's BARNABY leaderboard
- You steal ${process.env.VERMIN_STEAL_AMOUNT} point(s) from ALL players that catch you while you have this perk

**SWIPER**
- Awarded to the top 3 players on the previous week\'s BARNABY leaderboard
- This perk steals ${process.env.SWIPER_STEAL_PERCENTAGE}% of the TOTAL points of the next person you catch in addition to regularly awarded points
- One time use

**BOUNTY**
- Awarded to the player with the highest rarity. If there is a tie, a player is randomly chosen among those tied.
- This perk doubles the points of ALL catches you make while you have it!
- If you are caught, the points given to your catcher are doubled and the perk is removed
`;

module.exports = { HELP_POKEMON, HELP_COMMANDS, HELP_PERKS };