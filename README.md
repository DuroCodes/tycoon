# <img src="logo.png" alt="tycoon" width="32" height="32" style="vertical-align: middle;"> tycoon

a discord bot for stock trading and portfolio management. you can buy and sell stocks, track your portfolio performance, and compete on your server's leaderboard to get roles based on your net worth.

made by [@durocodes](https://github.com/durocodes), [@ziegeist227](https://github.com/ziegeist227), and [@goobytbh](https://github.com/goobytbh) for csci 2910

## tech used

- [bun](https://bun.sh)
- [discord.js](https://discord.js.org)
- [sern](https://sern.dev)
- [chart.js](https://chartjs.org)
- [drizzle](https://orm.drizzle.team)
- [yfinance](https://yfinancerestapi.com/)

## commands

### user commands

- `/buy <asset> <quantity> <money|shares>` - buy stocks
- `/sell <asset> <quantity> <money|shares>` - sell stocks
- `/portfolio [user]` - view a user's portfolio
- `/asset <asset> [period]` - view a stock's information
- `/leaderboard` - view the leaderboard
- `/donate <user> <amount>` - donate money to another user

### admin commands

- `/role <list|create|delete>` - manage role thresholds
- `/balance <set|add|remove> <user> <amount>` - manage a user's balance
- `/shares <set|add|remove> <user> <asset> <amount>` - manage a user's shares

## installation

1. clone the repo
2. install dependencies with `bun install` and `bun run build`
3. copy `.env.example` to `.env` and fill in the values
4. run `bun run migrate` to run the database migrations
5. run `bun run populate-prices` to populate the database with the initial prices
6. run `bun run start` to start the bot

## license

mit license, do whatever you want; just credit us :D
