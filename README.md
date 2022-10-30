# Description
A public bot that hosts a public room, automatically starts the match and limits difficulties of playlist maps.

# Install
1. Go to the project root directory, then run:
```
npm i
```

2. Move `.env.sample` to `.env`
```
mv .env.sample .env
```

3. Change the values inside, especially "required" ones

# Start
Type `LOG_LEVEL=info node . | npx pino-pretty -c -l`

or `LOG_LEVEL=debug node . | npx pino-pretty -c -l` to see more logs

# Contibuting
Feel free to make a PR, I will appreciate it!

# License
This bot's code is licensed under the MIT license.

Please see the licence file for more information. 
