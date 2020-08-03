module.exports = {
  name: '리로드',
  summary: '특정 명령어를 다시 불러옵니다.',
  aliases: ['reload'],
  usages: ['<명령어_이름>'],
  cooltime: 5,
  privileges: 1000,
  hasArgument: true,
  hideCommand: true,

  async execute(message, args) {
    const commandName = args[0].toLowerCase();
    const command = message.client.commands.get(commandName)
      || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

    if(!command)
      return message.channel.send(`오류: \`${commandName}\` 명령어 또는 별칭이 없습니다.`);

    try {
      delete require.cache[require.resolve(`./${command.name}.js`)];

      const newCommand = require(`./${command.name}.js`);
      message.client.commands.set(newCommand.name, newCommand);
    } catch(error) {
      console.log(error);
      return message.channel.send(
        `\`${command.name}\` 명령어를 다시 불러오는 도중에 오류가 발생했습니다:\n` +
        `\`\`\`\n${error.message}\`\`\``
      );
    }

    return message.channel.send(`\`${command.name}\` 명령어를 다시 불러왔습니다.`);
  }
};
