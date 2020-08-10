module.exports = {
  name: '주사위',
  summary: '임의의 숫자를 한 개 뽑습니다.',
  aliases: ['랜덤', 'dice', 'random'],
  usages: ['[최대_숫자=100]'],
  samples: ['  // 1 ~ 100', '500 // 1 ~ 500'],
  cooltime: 10,
  privileges: 1111,

  async execute(message, args) {
    let maxNumber = args[0] || 100;

    if(maxNumber === null || !/^\d+$/.test(maxNumber))
      return message.channel.send('조수 군! `최대_숫자`가 잘못된 것 같네.');

    const number = Math.floor(Math.random() * parseInt(maxNumber)) + 1;
    const prefix = /[2459]$/.test(number) ? '가' : '이';

    return message.channel.send(`주사위를 굴렸더니 \`${number}\`${prefix} 나왔다네. (1-${maxNumber})`);
  }
};
