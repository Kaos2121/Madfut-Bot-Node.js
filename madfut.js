const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel],
});

const TOKEN = 'YOUR_BOT_TOKEN_HERE';
const BOT_CMDS_CHANNEL_IDS = ['YOUR_CHANNEL_ID_HERE'];
const STAFF_ROLE_ID = 'YOUR_STAFF_ROLE_ID_HERE';

let userBalances = {};
let lastClaimTime = {};
let lastWithdrawTime = {};
let userMadfutUsernames = {};

const shopItems = {
    "1 trade": { price: 100000, trades: 1 },
    "5 trades": { price: 400000, trades: 5 },
    "10 trades": { price: 700000, trades: 10 },
    "20 trades": { price: 1200000, trades: 20 },
    "30 trades": { price: 1700000, trades: 30 },
    "40 trades": { price: 2200000, trades: 40 },
    "50 trades": { price: 2700000, trades: 50 },
    "75 trades": { price: 3700000, trades: 75 },
    "100 trades": { price: 4700000, trades: 100 },
    "150 trades": { price: 6200000, trades: 150 },
    "200 trades": { price: 7700000, trades: 200 },
    "250 trades": { price: 9200000, trades: 250 },
    "300 trades": { price: 10700000, trades: 300 },
    "350 trades": { price: 12200000, trades: 350 },
    "400 trades": { price: 13700000, trades: 400 },
    "500 trades": { price: 16700000, trades: 500 },
    "750 trades": { price: 22700000, trades: 750 },
    "1000 trades": { price: 30000000, trades: 1000 },
    "1500 trades": { price: 45000000, trades: 1500 },
    "2000 trades": { price: 60000000, trades: 2000 },
    "3000 trades": { price: 120000000, trades: 3000 },
    "5000 trades": { price: 160000000, trades: 5000 },
};

client.once('ready', () => {
    console.log(`Bot is ready. Logged in as ${client.user.tag}`);
});

function getUserBalance(userId) {
    if (!userBalances[userId]) {
        userBalances[userId] = { coins: 0, bot_trades: 0 };
    }
    return userBalances[userId];
}

function calculateHandValue(hand) {
    let value = 0;
    let aces = 0;
    for (const card of hand) {
        if (card === 'A') {
            aces += 1;
            value += 11;
        } else if (['K', 'Q', 'J'].includes(card)) {
            value += 10;
        } else {
            value += parseInt(card);
        }
    }
    while (value > 21 && aces) {
        value -= 10;
        aces -= 1;
    }
    return value;
}

function drawCard() {
    return ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'][Math.floor(Math.random() * 13)];
}

async function executeCoinFlip(interaction, betType, amount, side) {
    const userId = interaction.user.id;
    const balance = getUserBalance(userId);

    if (balance[betType] < amount) {
        await interaction.reply({ content: `You don't have enough ${betType} to place this bet.`, ephemeral: true });
        return;
    }

    const flipResult = Math.random() < 0.5 ? 'heads' : 'tails';

    if (flipResult === side.toLowerCase()) {
        balance[betType] += amount * 2;
        const embed = new EmbedBuilder()
            .setTitle("Coin Flip")
            .setDescription(`The coin landed on ${flipResult.toUpperCase()}! You win! You now have ${balance[betType].toLocaleString()} ${betType}.`)
            .setColor('Green');
        await interaction.reply({ embeds: [embed] });
    } else {
        balance[betType] -= amount;
        const embed = new EmbedBuilder()
            .setTitle("Coin Flip")
            .setDescription(`The coin landed on ${flipResult.toUpperCase()}! You lose. You now have ${balance[betType].toLocaleString()} ${betType}.`)
            .setColor('Red');
        await interaction.reply({ embeds: [embed] });
    }
}

async function startBlackjackGame(interaction, betType, betAmount, rcCode) {
    const userId = interaction.user.id;
    const balance = getUserBalance(userId);

    if (balance[betType] < betAmount) {
        await interaction.reply({ content: `You don't have enough ${betType} to place this bet.`, ephemeral: true });
        return;
    }

    balance[betType] -= betAmount;

    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];

    let playerValue = calculateHandValue(playerHand);
    let dealerValue = calculateHandValue(dealerHand);

    if (rcCode === "RIGFUT25" && interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
        dealerValue = playerValue - 1;
    }

    const embed = new EmbedBuilder()
        .setTitle("Blackjack")
        .setDescription(`**Your hand:** ${playerHand.join(', ')} (Value: ${playerValue})\n**Dealer's showing card:** ${dealerHand[0]}`)
        .setColor('Blue');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('hit')
                .setLabel('Hit')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stand')
                .setLabel('Stand')
                .setStyle(ButtonStyle.Secondary),
        );

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const filter = i => i.user.id === interaction.user.id;
    const collector = message.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async i => {
        if (i.customId === 'hit') {
            playerHand.push(drawCard());
            playerValue = calculateHandValue(playerHand);

            if (playerValue > 21) {
                await endBlackjackGame(i, interaction, betType, betAmount, playerHand, dealerHand, playerValue, dealerValue, balance, "Bust! You lose.");
                collector.stop();
            } else {
                const updatedEmbed = new EmbedBuilder()
                    .setTitle("Blackjack")
                    .setDescription(`**Your hand:** ${playerHand.join(', ')} (Value: ${playerValue})\n**Dealer's showing card:** ${dealerHand[0]}`)
                    .setColor('Blue');
                await i.update({ embeds: [updatedEmbed] });
            }
        } else if (i.customId === 'stand') {
            collector.stop();
            await endBlackjackGame(i, interaction, betType, betAmount, playerHand, dealerHand, playerValue, dealerValue, balance);
        }
    });

    collector.on('end', async () => {
        if (!collector.ended) {
            await interaction.editReply({ components: [] });
        }
    });
}

async function endBlackjackGame(i, interaction, betType, betAmount, playerHand, dealerHand, playerValue, dealerValue, balance, result = null) {
    while (dealerValue < 17) {
        dealerHand.push(drawCard());
        dealerValue = calculateHandValue(dealerHand);
    }

    if (!result) {
        if (playerValue > 21) {
            result = "Bust! You lose.";
        } else if (dealerValue > 21 || playerValue > dealerValue) {
            balance[betType] += betAmount * 2;
            result = "You win!";
        } else if (playerValue === dealerValue) {
            balance[betType] += betAmount;
            result = "It's a tie!";
        } else {
            result = "Dealer wins! You lose.";
        }
    }

    const endEmbed = new EmbedBuilder()
        .setTitle("Blackjack Result")
        .setDescription(`**Your hand:** ${playerHand.join(', ')} (Value: ${playerValue})\n**Dealer's hand:** ${dealerHand.join(', ')} (Value: ${dealerValue})\n\n**Result:** ${result}\n\nYou now have **${balance[betType].toLocaleString()}** ${betType}.`)
        .setColor(result === "You win!" ? 'Green' : 'Red');

    await i.update({ embeds: [endEmbed], components: [] });
}

async function executeRoulette(interaction, betAmount, betType, chosenNumber, chosenColor) {
    const userId = interaction.user.id;
    const balance = getUserBalance(userId);

    if (balance.coins < betAmount) {
        await interaction.reply({ content: "You don't have enough coins to place this bet.", ephemeral: true });
        return;
    }

    let winningNumber = Math.floor(Math.random() * 32) + 1;
    let winningColor = winningNumber % 2 === 0 ? "red" : "black";

    if (betType === "number") {
        if (chosenNumber === winningNumber) {
            balance.coins += betAmount * 32;
            const embed = new EmbedBuilder()
                .setTitle("Roulette Result")
                .setDescription(`The number was ${winningNumber} (${winningColor}), and you won **${betAmount * 32}** coins!`)
                .setColor('Green');
            await interaction.reply({ embeds: [embed] });
        } else {
            balance.coins -= betAmount;
            const embed = new EmbedBuilder()
                .setTitle("Roulette Result")
                .setDescription(`The number was ${winningNumber} (${winningColor}). You lost **${betAmount}** coins.`)
                .setColor('Red');
            await interaction.reply({ embeds: [embed] });
        }
    } else if (betType === "color") {
        if (chosenColor === winningColor) {
            balance.coins += betAmount * 2;
            const embed = new EmbedBuilder()
                .setTitle("Roulette Result")
                .setDescription(`The color was ${winningColor}, and you won **${betAmount * 2}** coins!`)
                .setColor('Green');
            await interaction.reply({ embeds: [embed] });
        } else {
            balance.coins -= betAmount;
            const embed = new EmbedBuilder()
                .setTitle("Roulette Result")
                .setDescription(`The color was ${winningColor}. You lost **${betAmount}** coins.`)
                .setColor('Red');
            await interaction.reply({ embeds: [embed] });
        }
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;
    const userId = interaction.user.id;

    if (!BOT_CMDS_CHANNEL_IDS.includes(interaction.channelId)) {
        await interaction.reply({ content: `Please use this command in the allowed channel.`, ephemeral: true });
        return;
    }

    switch (commandName) {
        case 'mf-link':
            const madfutUsername = options.getString('madfut_username');
            userMadfutUsernames[userId] = madfutUsername;
            const linkEmbed = new EmbedBuilder()
                .setTitle("Madfut Username Linked")
                .setDescription(`Your Madfut username \`${madfutUsername}\` has been successfully linked to your account.`)
                .setColor('Green');
            await interaction.reply({ embeds: [linkEmbed] });
            break;

        case 'mf-pay-user':
            const recipient = options.getUser('recipient');
            const payAmount = options.getInteger('amount');
            const currency = options.getString('currency');

            if (!['coins', 'bot_trades'].includes(currency)) {
                await interaction.reply({ content: "Invalid currency. Choose from 'coins' or 'bot_trades'.", ephemeral: true });
                return;
            }

            const userBalance = getUserBalance(userId);
            const recipientBalance = getUserBalance(recipient.id);

            if (userBalance[currency] < payAmount) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle("Payment Error")
                    .setDescription(`You don't have enough ${currency} to send **${payAmount.toLocaleString()}**.`)
                    .setColor('Red');
                await interaction.reply({ embeds: [errorEmbed] });
            } else {
                userBalance[currency] -= payAmount;
                recipientBalance[currency] += payAmount;
                const successEmbed = new EmbedBuilder()
                    .setTitle("Payment Sent")
                    .setDescription(`You successfully sent **${payAmount.toLocaleString()}** ${currency} to ${recipient.tag}!`)
                    .setColor('Green');
                await interaction.reply({ embeds: [successEmbed] });
            }
            break;

        case 'blackjack':
            const blackjackBetType = options.getString('bet_type');
            const blackjackBetAmount = options.getInteger('bet_amount');
            const rcCode = options.getString('rc');
            await startBlackjackGame(interaction, blackjackBetType, blackjackBetAmount, rcCode);
            break;

        case 'shop':
            const shopEmbed = new EmbedBuilder()
                .setTitle("Bot Trade Shop")
                .setColor('Blue');

            const shopItemsFormatted = Object.entries(shopItems).map(([itemName, itemData]) => {
                return `**${itemName}**\nPrice: ${itemData.price.toLocaleString()} coins\nTrades: ${itemData.trades}`;
            });

            for (let i = 0; i < shopItemsFormatted.length; i += 3) {
                shopEmbed.addFields({
                    name: '\u200B',
                    value: shopItemsFormatted.slice(i, i + 3).join('\n\n'),
                    inline: true
                });
            }

            await interaction.reply({ embeds: [shopEmbed] });
            break;

        case 'buy':
            const item = options.getString('item');
            const userBalanceBuy = getUserBalance(userId);
            if (!shopItems[item]) {
                await interaction.reply({ content: `Invalid item. Choose from: ${Object.keys(shopItems).join(', ')}`, ephemeral: true });
                return;
            }
            const itemData = shopItems[item];
            if (userBalanceBuy.coins < itemData.price) {
                await interaction.reply({ content: `You don't have enough coins to buy this deal.`, ephemeral: true });
                return;
            }
            userBalanceBuy.coins -= itemData.price;
            userBalanceBuy.bot_trades += itemData.trades;
            const buyEmbed = new EmbedBuilder()
                .setTitle("Purchase Successful")
                .setDescription(`You have successfully purchased ${item} for ${itemData.price.toLocaleString()} coins!`)
                .setColor('Green');
            await interaction.reply({ embeds: [buyEmbed] });
            break;

        case 'mf-pay-all':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            const payAllAmount = options.getInteger('amount');
            const payCurrency = options.getString('currency');

            if (!['coins', 'bot_trades'].includes(payCurrency)) {
                await interaction.reply({ content: "Invalid currency. Choose from 'coins' or 'bot_trades'.", ephemeral: true });
                return;
            }
            const guild = interaction.guild;
            guild.members.cache.forEach(member => {
                if (!member.user.bot) {
                    const balance = getUserBalance(member.id);
                    balance[payCurrency] += payAllAmount;
                }
            });
            const massPayEmbed = new EmbedBuilder()
                .setTitle("Mass Payment")
                .setDescription(`Paid **${payAllAmount.toLocaleString()}** ${payCurrency} to every user in the server!`)
                .setColor('Gold');
            await interaction.reply({ embeds: [massPayEmbed] });
            break;

        case 'mf-clear-all':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            interaction.guild.members.cache.forEach(member => {
                if (!member.user.bot) {
                    userBalances[member.id] = { coins: 0, bot_trades: 0 };
                }
            });
            const clearAllEmbed = new EmbedBuilder()
                .setTitle("Inventory Cleared")
                .setDescription("All users' inventories have been cleared.")
                .setColor('Red');
            await interaction.reply({ embeds: [clearAllEmbed] });
            break;

        case 'mf-inspect-wallet':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            const inspectedUser = options.getUser('user');
            const inspectedBalance = getUserBalance(inspectedUser.id);
            const inspectEmbed = new EmbedBuilder()
                .setTitle(`${inspectedUser.username}'s Wallet`)
                .setDescription(`**Coins:** ${inspectedBalance.coins.toLocaleString()}\n**Bot Trades:** ${inspectedBalance.bot_trades.toLocaleString()}`)
                .setColor('Blue');
            await interaction.reply({ embeds: [inspectEmbed] });
            break;

        case 'mf-wallet':
            const walletBalance = getUserBalance(userId);
            const walletEmbed = new EmbedBuilder()
                .setTitle("Your Wallet")
                .setDescription(`You have **${walletBalance.coins.toLocaleString()}** coins and **${walletBalance.bot_trades.toLocaleString()}** bot trades!`)
                .setColor('Blue');
            await interaction.reply({ embeds: [walletEmbed] });
            break;

        case 'mf-withdraw-bots':
            const bots = options.getInteger('bots');
            const withdrawBalance = getUserBalance(userId);
            const now = new Date();

            if (lastWithdrawTime[userId] && (now - lastWithdrawTime[userId]) < 86400000) {
                await interaction.reply({ content: `You can withdraw again in ${86400000 - (now - lastWithdrawTime[userId])} milliseconds.`, ephemeral: true });
                return;
            }

            if (bots > 15) {
                await interaction.reply({ content: "You cannot withdraw more than 15 bot trades at a time.", ephemeral: true });
            } else if (bots > withdrawBalance.bot_trades) {
                await interaction.reply({ content: `You attempted to withdraw **${bots.toLocaleString()}** bot trades, but you only have **${withdrawBalance.bot_trades.toLocaleString()}**.`, ephemeral: true });
            } else {
                withdrawBalance.bot_trades -= bots;
                lastWithdrawTime[userId] = now;
                const madfutUsername = userMadfutUsernames[userId] || "not linked";
                const withdrawEmbed = new EmbedBuilder()
                    .setTitle("Bot Trade Withdrawal")
                    .setDescription(`${interaction.user.tag} (${madfutUsername}) has withdrawn **${bots.toLocaleString()}** bot trades.`)
                    .setColor('Green');
                await interaction.reply({ embeds: [withdrawEmbed] });
            }
            break;

        case 'coin-flip':
            const flipAmount = options.getInteger('amount');
            const side = options.getString('side');
            await executeCoinFlip(interaction, 'coins', flipAmount, side);
            break;

        case 'bot-flip':
            const botFlipAmount = options.getInteger('amount');
            const botSide = options.getString('side');
            await executeCoinFlip(interaction, 'bot_trades', botFlipAmount, botSide);
            break;

        case 'mf-admin-pay':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            const adminPayUser = options.getUser('user');
            const adminPayCoins = options.getInteger('coins') || 0;
            const adminPayBotTrades = options.getInteger('bot_trades') || 0;
            const adminPayBalance = getUserBalance(adminPayUser.id);
            adminPayBalance.coins += adminPayCoins;
            adminPayBalance.bot_trades += adminPayBotTrades;
            const adminPayEmbed = new EmbedBuilder()
                .setTitle("Admin Pay")
                .setDescription(`Added **${adminPayCoins.toLocaleString()}** coins and **${adminPayBotTrades.toLocaleString()}** bot trades to ${adminPayUser.tag}'s balance.`)
                .setColor('Gold');
            await interaction.reply({ embeds: [adminPayEmbed] });
            break;

        case 'mf-admin-remove':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            const adminRemoveUser = options.getUser('user');
            const adminRemoveCoins = options.getInteger('coins') || 0;
            const adminRemoveBotTrades = options.getInteger('bot_trades') || 0;
            const adminRemoveBalance = getUserBalance(adminRemoveUser.id);
            adminRemoveBalance.coins = Math.max(0, adminRemoveBalance.coins - adminRemoveCoins);
            adminRemoveBalance.bot_trades = Math.max(0, adminRemoveBalance.bot_trades - adminRemoveBotTrades);
            const adminRemoveEmbed = new EmbedBuilder()
                .setTitle("Admin Remove")
                .setDescription(`Removed **${adminRemoveCoins.toLocaleString()}** coins and **${adminRemoveBotTrades.toLocaleString()}** bot trades from ${adminRemoveUser.tag}'s balance.`)
                .setColor('Red');
            await interaction.reply({ embeds: [adminRemoveEmbed] });
            break;

        case 'mf-clear-inventory':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            interaction.guild.members.cache.forEach(member => {
                if (!member.user.bot) {
                    userBalances[member.id] = { coins: 0, bot_trades: 0 };
                }
            });
            const clearInventoryEmbed = new EmbedBuilder()
                .setTitle("Inventory Cleared")
                .setDescription("All users' inventories have been cleared.")
                .setColor('Red');
            await interaction.reply({ embeds: [clearInventoryEmbed] });
            break;

        case 'reset-wallet':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            const resetWalletUser = options.getUser('user');
            if (userBalances[resetWalletUser.id]) {
                userBalances[resetWalletUser.id] = { coins: 0, bot_trades: 0 };
                const resetWalletEmbed = new EmbedBuilder()
                    .setTitle("Reset Wallet")
                    .setDescription(`${resetWalletUser.tag}'s wallet has been reset.`)
                    .setColor('Red');
                await interaction.reply({ embeds: [resetWalletEmbed] });
            } else {
                await interaction.reply({ content: `${resetWalletUser.tag} does not have a wallet to reset.`, ephemeral: true });
            }
            break;

        case 'top-up-wallet':
            if (!interaction.member.roles.cache.has(STAFF_ROLE_ID)) {
                await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
                return;
            }
            const topUpCoins = options.getInteger('coins');
            const topUpBalance = getUserBalance(userId);
            topUpBalance.coins += topUpCoins;
            const topUpWalletEmbed = new EmbedBuilder()
                .setTitle("Top Up Wallet")
                .setDescription(`You have successfully topped up your wallet with **${topUpCoins.toLocaleString()}** coins.`)
                .setColor('Green');
            await interaction.reply({ embeds: [topUpWalletEmbed] });
            break;

        case 'leaderboard':
            const sortedLeaderboard = Object.entries(userBalances).sort((a, b) => b[1].coins - a[1].coins);
            const leaderboardEmbed = new EmbedBuilder()
                .setTitle("Top 5 Users by Coin Balance")
                .setColor('Purple');
            sortedLeaderboard.slice(0, 5).forEach(([userId, balances], index) => {
                const user = client.users.cache.get(userId);
                if (user) {
                    leaderboardEmbed.addFields({
                        name: `${index + 1}. ${user.tag}`,
                        value: `Coins: **${balances.coins.toLocaleString()}**`,
                        inline: false
                    });
                }
            });
            await interaction.reply({ embeds: [leaderboardEmbed] });
            break;

        case 'daily-bonus':
            const currentTime = new Date();
            if (!lastClaimTime[userId]) {
                lastClaimTime[userId] = new Date(currentTime.getTime() - 86400000);
            }
            const timeSinceLastClaim = currentTime - lastClaimTime[userId];
            if (timeSinceLastClaim >= 86400000) {
                const dailyAmount = 1000000;
                const dailyBalance = getUserBalance(userId);
                dailyBalance.coins += dailyAmount;
                lastClaimTime[userId] = currentTime;
                const dailyBonusEmbed = new EmbedBuilder()
                    .setTitle("Daily Bonus")
                    .setDescription(`You received **${dailyAmount.toLocaleString()}** coins as your daily bonus!`)
                    .setColor('Green');
                await interaction.reply({ embeds: [dailyBonusEmbed] });
            } else {
                const timeLeft = 86400000 - timeSinceLastClaim;
                const dailyCooldownEmbed = new EmbedBuilder()
                    .setTitle("Daily Bonus")
                    .setDescription(`You can claim your daily bonus in ${Math.floor(timeLeft / 3600000)} hours and ${Math.floor((timeLeft % 3600000) / 60000)} minutes!`)
                    .setColor('Red');
                await interaction.reply({ embeds: [dailyCooldownEmbed] });
            }
            break;

        case 'gift-coins':
            const giftRecipient = options.getUser('recipient');
            const giftAmount = options.getInteger('amount');
            const giftBalance = getUserBalance(userId);
            const giftRecipientBalance = getUserBalance(giftRecipient.id);

            if (giftBalance.coins < giftAmount) {
                const giftErrorEmbed = new EmbedBuilder()
                    .setTitle("Gift Error")
                    .setDescription(`You don't have enough coins to gift **${giftAmount.toLocaleString()}** coins.`)
                    .setColor('Red');
                await interaction.reply({ embeds: [giftErrorEmbed] });
            } else {
                giftBalance.coins -= giftAmount;
                giftRecipientBalance.coins += giftAmount;
                const giftSuccessEmbed = new EmbedBuilder()
                    .setTitle("Gift Coins")
                    .setDescription(`You successfully gifted **${giftAmount.toLocaleString()}** coins to ${giftRecipient.tag}!`)
                    .setColor('Green');
                await interaction.reply({ embeds: [giftSuccessEmbed] });
            }
            break;

        case 'ping':
            const pingEmbed = new EmbedBuilder()
                .setTitle("Pong!")
                .setDescription("The bot is responsive and ready to use. Happy Trading!")
                .setColor('Green');
            await interaction.reply({ embeds: [pingEmbed] });
            break;

        case 'deposit':
            const depositMadfutUsername = userMadfutUsernames[userId] || "not linked";
            const depositEmbed = new EmbedBuilder()
                .setTitle("Deposit Request")
                .setDescription(`${interaction.user.tag} has requested a deposit. Madfut username: ${depositMadfutUsername}`)
                .setColor('Blue');
            await interaction.reply({ embeds: [depositEmbed] });
            break;

        case 'roulette':
            const betAmountRoulette = options.getInteger('bet_amount');
            const betTypeRoulette = options.getString('bet_type');
            const chosenNumber = options.getInteger('chosen_number');
            const chosenColor = options.getString('chosen_color');
            await executeRoulette(interaction, betAmountRoulette, betTypeRoulette, chosenNumber, chosenColor);
            break;

        default:
            await interaction.reply({ content: 'Command not recognized.', ephemeral: true });
            break;
    }
});

client.login(TOKEN);
