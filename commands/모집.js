/* eslint-disable indent */
const RECRUIT_MODE_CHECK = 1;
const RECRUIT_MODE_SET = 2;
const RECRUIT_MODE_MODIFY = 3;
const RECRUIT_MODE_RESET = 4;

module.exports = {
  name: '모집',
  summary: '보스 참전 인원을 모집합니다.',
  description: ''
  ,
  usages: [
    '<네임드_정보> <체력>',
    '<확인|현황>',
    '<리셋|삭제|초기화>',
  ],
  samples: [
    '24-4 12000000',
    '24-4 1200만',
    '24-4 1200'
  ],
  cooltime: 1, // @TODO
  privileges: 1110,
  hasArgument: true,
  checkStrict: true,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    let bossState = config.boss_state;

    /* 매개 변수 처리 시작 */
    let argument = null;
    let mode = RECRUIT_MODE_SET;
    let namedNumber = null;
    let remainHp = null;
    let errorString = '';

    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      let match = null;

      if(/^등록|리셋|변경|삭제|수정|설정|초기화|확인|현황$/.test(argument)) {
        mode =
          (['확인', '현황'].includes(argument)) ? RECRUIT_MODE_CHECK :
          (['등록', '설정'].includes(argument)) ? RECRUIT_MODE_SET :
          (['변경', '수정'].includes(argument)) ? RECRUIT_MODE_MODIFY :
          (['리셋', '삭제', '초기화'].includes(argument)) ? RECRUIT_MODE_RESET : RECRUIT_MODE_SET;
        continue;
      }

      // 네임드 정보로 추정되는 문자열 처리 (1 ... 5, 24-4 둘 다 처리)
      if((match = argument.match(/^(([1-9][0-9]?)-)?([1-5])넴?$/)) !== null) {
        namedNumber = match[0];
        continue;
      }

      // 보스 HP 정보로 추정되는 문자열 처리
      if((match = argument.match(/^([0-9]{3,8})만?$/)) !== null) {
        remainHp = parseInt(match[0]);
        if(remainHp <= 2000) remainHp *= 10000;
        continue;
      }

      // 나머지 문자열은 미 인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }

    // 발견된 오류 처리
    if(mode === RECRUIT_MODE_SET && namedNumber === null)
      errorString += '조수 군! 네임드 정보를 말해주게나. (예: `24-4`)\n';
    if(mode === RECRUIT_MODE_SET && remainHp === null)
      errorString += '조수 군! 잔여 보스 HP 정보를 말해주게나. (예: `1200` 또는 `2000만`)\n';

    if(errorString.length > 0)
      return message.channel.send(errorString);
    /* 매개 변수 처리 완료 */


    // 모집 정보 설정
    switch(mode) {
    case RECRUIT_MODE_CHECK: {
      return message.client.commands.get('실전').execute(message, ['확인']);
    }
    case RECRUIT_MODE_SET: {
      bossState = Object.assign(bossState, { boss_num: namedNumber, remain_hp: remainHp, entries: {} });
      this.execute(message, ['확인']);
      break;
    }
    case RECRUIT_MODE_MODIFY: {
      if(!bossState.boss_num || !bossState.remain_hp)
        return message.channel.send('조수 군! 모집부터 해야하네.');

      if(namedNumber != null) bossState.boss_num = namedNumber;
      if(remainHp != null) bossState.remain_hp = remainHp;

      this.execute(message, ['확인']);
      break;
    }
    case RECRUIT_MODE_RESET:
      delete bossState.boss_num;
      delete bossState.remain_hp;
      delete bossState.entries;
      message.channel.send('모집 목록을 초기화 했다네.');
      break;
    }

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${__dirname}/../config/${message.guild.id}/config.json`, config);
  }
};
