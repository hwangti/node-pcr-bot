module.exports = {
  name: '이모티콘',
  category: 'util',
  summary: 'Discord 이모티콘을 확대해서 보여줍니다',
  description: ''
  ,
  aliases: ['ㄷ', 'e'],
  privileges: 1111,

  async execute(message, args) {
    // console.log(require('util').inspect(message, false, 4, true));

    if(args.length !== 1) return;
    let match = args[0].match(/^<(a)?:[\d\w_]+:(\d{18,})>$/);

    if(match) {
      message.delete().then()
        .catch(console.error)
        .finally(
          message.channel.send(null, { embed: {
            author: {
              name: message.guild.member(message.author.id).displayName,
              icon_url: message.author.avatarURL()
            },
            color: message.guild.member(message.author.id).displayHexColor,
            image: {
              url: `https://cdn.discordapp.com/emojis/${match[2]}.${match[1]=='a'?'gif':'png'}?v=1`
            }
          }})
        );
    }
  }
};
