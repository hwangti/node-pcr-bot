const CALC_MODE_DEAL = 1;
const CALC_MODE_SECOND = 2;

module.exports = {
  name: '이월계산',
  category: 'priconne',
  summary: '이월 받을 수 있는 시간이나 딜량을 계산합니다.',
  description:
    '`보스HP`, `파티딜량`은 `221`, `552575` 등으로 입력합니다. 4자리 이하 딜량은 만단위로 인식됩니다.\n\n' +
    '- 이월 받는 시간을 계산:\n' +
    '`보스HP`는 남아있는 보스 HP를 입력합니다.\n' +
    '`파티딜량`은 파티의 딜량을 2개 이하로 입력합니다.\n\n' +
    '- x초 이월을 받고 싶을 때 필요한 딜량을 계산:\n' +
    '`보스HP`는 남아있는 보스 HP를 입력합니다.\n' +
    '`시간`은 받고 싶은 시간을 초 단위로 입력합니다. (예: `66초`, `89초`)\n' +
    '(반드시 초를 입력해야 정상적으로 인식됩니다.)\n\n'
  ,
  aliases: ['계산', '풀이월', '이월시간', '시간'],
  usages: ['<보스HP> [파티딜량]', '<보스HP> [시간=90초]'],
  samples: ['211 235', '2114422 1653031 1744221', '2114422 66초'],
  privileges: 1111,
  hasArgument: true,

  /*
  !풀이월 -> !이월시간 풀이월 345(보스HP) 90(초)
  !이월시간 -> !이월시간 이월시간 141(보스HP) 233 424

  !풀이월 123만 70초
  */

  async execute(message, args) {
    /* 매개 변수 처리 시작 */
    let mode = CALC_MODE_DEAL;
    let argument = '';
    let numbers = [];
    let seconds = 90;

    let errorString = '';

    while((argument = args.shift()) !== undefined) {
      let match = null;
      if((match = argument.match(/^([\d\-+]+)([만초]?)$/)) !== null) {
        const number = parseInt(eval(match[1]));
        if(number <= 90 && match[2] == '초') {
          seconds = parseInt(match[1]);
          mode = CALC_MODE_SECOND;
          continue;
        }

        numbers.push(number < 10000 ? number * 10000 : number);
        continue;
      }

      // 나머지 문자열은 미인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }

    if(numbers.length === 1) mode = CALC_MODE_SECOND;

    if(numbers.length > 3)
      errorString += '조수 군! 파티는 보스 HP를 제외하고 2개까지 입력할 수 있다네.\n';
    if(errorString.length > 0)
      return message.channel.send(errorString);


    switch(mode) {
    case CALC_MODE_DEAL: {
      const bossHp = numbers.shift();
      let dealSum = numbers.reduce((prev, next) => prev + next);

      if(bossHp > dealSum)
        return message.channel.send('조수 군! 잔여 보스 HP가 파티의 딜량보다 높아! (이월 불가)');

      let text = '', number = null, party = 0;
      while((number = numbers.shift()) != null) {
        ++party;

        if(bossHp <= number) text = '', dealSum = number;
        text += `- 파티 ${party} (${global.fn.numberFormat(number)}): `;
        text += `\`${Math.min(90, Math.ceil((dealSum - bossHp) / number * 90 + 20))}초\`\n`;
        if(bossHp <= number) break;
      }

      return message.channel.send({ embed: {
        title: '이월 받는 시간 계산',
        fields: [
          { name: '잔여 보스 HP', value: global.fn.numberFormat(bossHp) },
          { name: '파티', value: text }
        ]
      }});
    }
    case CALC_MODE_SECOND: {
      const bossHp = numbers.shift();

      return message.channel.send({ embed: {
        title: `${seconds}초 이월에 필요한 딜량`,
        fields: [
          {
            name: '필요 딜량',
            value: '`' + global.fn.numberFormat(Math.ceil(90 * bossHp / (110.999999 - seconds))) + '`',
          },
          {
            name: `참고 (잔여 보스 HP: ${global.fn.numberFormat(bossHp)})`,
            value:
              `- 30초: \`${global.fn.numberFormat(Math.ceil(90 * bossHp / (110.9999999999 - 30)))}\`\n` +
              `- 45초: \`${global.fn.numberFormat(Math.ceil(90 * bossHp / (110.9999999999 - 45)))}\`\n` +
              `- 60초: \`${global.fn.numberFormat(Math.ceil(90 * bossHp / (110.9999999999 - 60)))}\`\n` +
              `- 75초: \`${global.fn.numberFormat(Math.ceil(90 * bossHp / (110.9999999999 - 75)))}\`\n` +
              `- 90초: \`${global.fn.numberFormat(Math.ceil(90 * bossHp / (110.9999999999 - 90)))}\`\n`
          }
        ]
      }});
    } // end of case
    } // end of switch(mode)
  }
};
