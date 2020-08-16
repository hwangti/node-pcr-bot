module.exports = {
  name: '이월택틱',
  category: 'priconne',
  summary: '이월 시간에 맞는 택틱을 출력합니다.',
  description:
    '`이월시간`은 받은 이월 시간을 입력합니다. (예: `1:08`, `108`, `68`, `68초`)\n' +
    '`택틱`은 택틱 내용을 입력합니다. (줄바꿈 지원: Shift+Enter)\n\n' +
    '택틱에서 인식되는 시간은 `1:08`, `108`, `068`, `68초` 등입니다.\n' +
    '두자리 숫자(예: `68`)는 모호하므로 인식되지 않습니다.'
  ,
  aliases: ['택틱'],
  usages: ['<이월시간> <택틱>'],
  samples: ['45 택틱내용'],
  privileges: 1111,

  async execute(message, args) {
    if(args.length < 2)
      return message.channel.send('조수 군! `이월시간`과 `택틱`을 모두 입력해 줘!');

    const bonusTime = replaceTacticTime(args.shift(), 90, true);
    if(typeof bonusTime !== 'number')
      return message.channel.send('조수 군! `이월시간`이 잘못된 것 같아. (`1:08`, `068`, `68초` 등');

    let tacticString = args.join(' ');
    let reserveString = tacticString.replace(
      /([01]:\d{1,}|\d{3,}초?|\d{1,}초)/g,
      ((match, p1 /*, p2, p3, offset, string */) => replaceTacticTime(p1, bonusTime))
    );

    let lineSplit = reserveString.split('\n');
    let splitString = '';
    let overCount = 0;
    for(let i=0, length=lineSplit.length; i<length; i++) {
      splitString += lineSplit[i] + '\n';

      if(lineSplit[i].indexOf('[-:--]') > -1) ++overCount;
      if(overCount >= 3) break;
    }

    return message.channel.send({ embed: {
      // title: `이월 전용 타임라인 (${bonusTime}초 기준)`,
      description:
        '인식된 시간 부분은 `[?:??]` 으로 변환\n' +
        '`[0:00]` 또는 `[-:--]` 이 있는 줄은 시간에 유의할 것'
      ,
      fields: [{
        name: `타임라인 (${bonusTime}초 기준)`,
        value: '```cs\n' + splitString + '\n```'
      }],
      footer: { text: '이월 전용 택틱 생성기' },
      timestamp: Date.now()
    }});
  }
};

function replaceTacticTime(timeString, bonusTime = 90, isStrict = false) {
  const timePattern = /^(([01][:분])?\d+초?)$/;

  const match = timeString.match(timePattern);
  if(match == null || /^\d{4,}$/.test(match[1])) return timeString;

  let seconds = match[1].replace('분', '*60+').replace(':', '*60+').replace('초', '');
  if(seconds.length === 3 && seconds.startsWith('0')) seconds = seconds.substr(1,2); // 8진수 체크
  seconds = eval(seconds);

  if(typeof seconds !== 'number') return timeString;
  if(seconds >= 100) seconds -= 40; // 103 -> 63
  if(seconds > 90) return timeString;

  // 실제 시간 계산
  seconds -= (90 - bonusTime);
  if(seconds < 0) return '[-:--]';

  let result = new Date(null);
  result.setSeconds(seconds);

  return isStrict ? seconds : `[${result.toISOString().substr(15,4)}]`;
}
