const fs = require('fs');

module.exports = {
  name: 'bot',
  category: 'system',
  summary: null,
  hasArgument: true,
  privileges: 1000,
  hideCommand: true,

  async execute(message, args) {
    const argument = args.shift();

    switch(argument) {
    case 'avatar': {
      const link = message.attachments.first().url;
      return message.client.user.setAvatar(link);
    }
    case 'kill': {
      return process.exit(0);
    }
    case 'nickname': {
      return message.client.user.setUsername(argument);
    }
    case 'ping': {
      return message.channel.send(`Time diff: ${Date.now() - message.createdTimestamp}ms`);
    }
    case 'save': {
      const server = fs.readdirSync(`${global.dirname}/config`).filter(file => /^\d{18,}$/.test(file));
      server.map(s => {
        const config = message.client.config.get(`${s}_config`);
        if(config == null) return;

        global.fn.saveConfig(`${global.dirname}/config/${s}/config.json`, config);
        message.channel.send(`save complete: \`${s}\` (${message.client.guilds.cache.get(s)})`);
      });
      break;
    }
    case 'uptime': {
      return message.channel.send(`Uptime: ${process.uptime()}`);
    }
    }
  }
};
