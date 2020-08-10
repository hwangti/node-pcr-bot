const fs = require('fs');

module.exports = {
  name: 'bot',
  summary: null,
  hasArgument: true,
  privileges: 1000,
  hideCommand: true,

  async execute(message, args) {
    const argument = args.shift();

    switch(argument) {
    case 'avatar': {
      const link = message.attachments.first().url;
      message.client.user.setAvatar(link);
      break;
    }
    case 'kill': {
      return process.exit(0);
    }
    case 'nickname': {
      message.client.user.setUsername(argument);
      break;
    }
    case 'ping': {
      message.channel.send(`Time diff: ${Date.now() - message.createdTimestamp}ms`);
      break;
    }
    case 'presence': {
      message.client.user.setPresence({ activity: { name: `옴닉 ${message.client.version}` }, status: 'online' });
      break;
    }
    case 'save': {
      const server = fs.readdirSync(`${__dirname}/../config`).filter(file => /^\d{18,}$/.test(file));
      server.map(s => {
        const config = message.client.config.get(`${s}_config`);
        if(config == null) return;

        global.fn.saveConfig(`${__dirname}/../config/${s}/config.json`, config);
        message.channel.send(`save complete: \`${s}\` (${message.client.guilds.cache.get(s)})`);
      });
      break;
    }
    }
  }
};
