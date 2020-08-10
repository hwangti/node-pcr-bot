module.exports = {
  name: '클랜시트',
  summary: '클랜시트를 출력합니다.',
  aliases: ['시트', '구글시트', '스프레드시트', 'sheet', 'spreadsheet'],
  privileges: 1110,

  async execute(message, args) {
    let config = message.client.config.get(`${message.guild.id}_config`);
    let sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);

    if(!sheetConfig.spreadsheet_id)
      return message.channel.send('조수 군! 먼저 클랜 시트를 설정해주게나.');

    if(/설정/.test(args.join(' ')) === true)
      return message.channel.send(
        '클랜 시트 주소를 변경하려면 아래의 명령어를 입력하게나.\n' +
        `\`\`\`${config.prefix}설정 시트 <시트주소>\`\`\``);

    return message.channel.send({ embed: {
      title: '클랜 시트',
      description: 'https://docs.google.com/spreadsheets/d/' + sheetConfig.spreadsheet_id
    }});
  }
};
