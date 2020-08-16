const { statSync } = require('fs');

module.exports = {
  name: '도움말',
  category: 'help',
  summary: '모든 명령어 또는 특정 명령어에 대한 설명을 표시합니다.',
  aliases: ['명령어', '설명', '커맨드', '헬프', 'command', 'help'],
  usages: ['[명령어_이름]'],
  privileges: 1111,

  async execute(message, args) {
    const prefix = message.client.config.get(`${message.guild.id}_config`).prefix;
    const { commands } = message.client;

    // 명령어만 입력했다면
    if(args.length === 0) {
      const helpObject = {};
      const category = ['help', 'system', 'priconne', 'clanbattle', 'game', 'util'];
      const categoryName = ['도움말', '시스템', '프리코네', '클랜전', '게임', '유틸'];

      commands.forEach(command => {
        if(command.hideCommand) return;

        if(!helpObject[command.category]) helpObject[command.category] = '';
        helpObject[command.category] += `\`${prefix}${command.name}\` - ${command.summary}\n`;
      });

      let helpString = '';
      for(let i=0, length=category.length; i<length; i++) {
        helpString += `===== 🔹**\`${categoryName[i]}\`** 관련 명령어 🔹 =====\n`;
        helpString += helpObject[category[i]] + '\n';
      }

      return message.channel.send({ embed: {
        title: '명령어 목록',
        description:
          helpString +
          `\`${prefix}도움말 [명령어_이름]\` 을 입력해서 자세한 설명을 볼 수 있다네, 조수 군!`
        ,
        footer: { text: '최종 업데이트' },
        timestamp: parseInt(statSync(__filename).mtimeMs)
      }});
    }

    // 특정 명령어에 대한 설명 처리
    const name = args[0].toLowerCase();
    const command = commands.get(name) || commands.find(c => c.aliases && c.aliases.includes(name));

    if(command === undefined)
      return message.channel.send('조수 군! 무슨 말인지 모르겠다네.');

    if(command.hideCommand) return;

    const embed = {
      title: `${prefix}${command.name}`,
      footer: {
        text: '최종 업데이트'
      },
      timestamp: parseInt(statSync(`${global.dirname}/commands/${command.category}/${command.name}.js`).mtimeMs),
      fields: []
    };

    // 해당 필드 값 존재에 따라서 추가 정보 표시
    if(command.summary || command.description)
      embed.description =
        (command.summary ? command.summary + '\n\n' : '') +
        (command.description ? command.description : '');

    if(command.usages)
      embed.fields.push({
        name: '매개 변수',
        value: '\n' + command.usages.map(value => `${prefix}${command.name} ${value}`).join('\n') + ''
      });

    if(command.aliases)
      embed.fields.push({
        name: '별칭',
        value: command.aliases.map(value => `\`${prefix}${value}\``).join(' ')
      });

    if(command.samples)
      embed.fields.push({
        name: '예시',
        value: '\n' + command.samples.map(value => `> ${prefix}${command.name} ${value}`).join('\n') + ''
      });

    if(command.cooltime)
      embed.fields.push({
        name: '쿨타임',
        value: command.cooltime + '초'
      });

    if(command.privileges) {
      const flags = parseInt(command.privileges, 2);
      embed.fields.push({
        name: '권한',
        value: (flags & 1) === 1 ? '누구나' :
          (flags & 2) > 1 ? '클랜원 이상' :
            (flags & 4) > 1 ? '운영진 이상' :
              (flags & 8) > 1 ? '소유자' : '?'
      });
    }


    if(command.hasArgument)
      embed.fields.push({
        name: '매개 변수 필요',
        value: 'Y'
      });

    return message.channel.send({ embed: embed });
  }
};
