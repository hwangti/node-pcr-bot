/* eslint-disable indent */
const RECRUIT_MODE_CHECK = 1;
const RECRUIT_MODE_SET = 2;
const RECRUIT_MODE_MODIFY = 3;
const RECRUIT_MODE_RESET = 4;
const RECRUIT_MODE_SYNC = 5;

module.exports = {
  name: '모집',
  category: 'clanbattle',
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

      if(/^확인|현황|등록|설정|변경|수정|리셋|삭제|초기화|동기화$/.test(argument)) {
        mode =
          (['확인', '현황'].includes(argument)) ? RECRUIT_MODE_CHECK :
          (['등록', '설정'].includes(argument)) ? RECRUIT_MODE_SET :
          (['변경', '수정'].includes(argument)) ? RECRUIT_MODE_MODIFY :
          (['리셋', '삭제', '초기화'].includes(argument)) ? RECRUIT_MODE_RESET :
          (['동기화'].includes(argument)) ? RECRUIT_MODE_SYNC : RECRUIT_MODE_SET;
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

    if(config.sheet_type !== 'MOMO')
      return message.channel.send('조수 군! 이 서버에서는 사용할 수 없는 명령어라네.\n');
    if(errorString.length > 0)
      return message.channel.send(errorString);
    /* 매개 변수 처리 완료 */


    // 모집 정보 설정
    switch(mode) {
    case RECRUIT_MODE_CHECK: {
      return message.client.commands.get('실전').execute(message, ['확인']);
    }
    case RECRUIT_MODE_SET: {
      if(bossState.remain_hp != null && bossState.remain_hp !== 0)
        return message.channel.send(
          '경고: 진행 중인 모집 정보가 있는데 새로 모집 하려는건가, 조수 군?\n' +
          '맞으면 10초 이내로 `ㅇㅇ` 를 입력하게나.'
        ).then(() => {
          const filter = m => message.author.id === m.author.id;

          message.channel
            .awaitMessages(filter, { time: 10000, max: 1, errors: ['time'] })
            .then(async messages => {
              if(['ㅇㅇ'].includes(messages.first().content.trim()) === false)
                return message.channel.send('실행을 취소했다네.');

              bossState = Object.assign(bossState, { boss_num: namedNumber, remain_hp: remainHp, entries: {} });
              Object.entries(bossState.entries).forEach(value => {
                message.guild.member(value[0]).roles.remove('744835514003226654');
              });
              this.execute(message, ['확인']);
            }).catch(() => {
              message.channel.send('입력 시간이 지났으니 실행을 취소하겠네.');
            });
        });

      bossState = Object.assign(bossState, { boss_num: namedNumber, remain_hp: remainHp, entries: {} });
      Object.entries(bossState.entries).forEach(value => {
          message.guild.member(value[0]).roles.remove('744835514003226654');
        });
      this.execute(message, ['확인']);
      break;
    }
    case RECRUIT_MODE_MODIFY: {
      if(!bossState.boss_num) // || !bossState.remain_hp)
        return message.channel.send('조수 군! 모집부터 해야하네.');

      if(namedNumber != null) bossState.boss_num = namedNumber;
      if(remainHp != null) bossState.remain_hp = remainHp;

      this.execute(message, ['확인']);
      break;
    }
    case RECRUIT_MODE_RESET: {
      return message.channel.send(
        '경고: 모집 목록을 초기화하려고 하는건가, 조수 군?\n' +
        '맞으면 10초 이내로 `ㅇㅇ` 를 입력하게나.'
      ).then(() => {
        const filter = m => message.author.id === m.author.id;

        message.channel
          .awaitMessages(filter, { time: 10000, max: 1, errors: ['time'] })
          .then(async messages => {
            if(['ㅇㅇ'].includes(messages.first().content.trim()) === false)
              return message.channel.send('실행을 취소했다네.');

            delete bossState.boss_num;
            delete bossState.remain_hp;
            delete bossState.entries;
            bossState.entries = {};
            Object.entries(bossState.entries).forEach(value => {
              message.guild.member(value[0]).roles.remove('744835514003226654');
            });
            global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/config.json`, config);
            message.channel.send('모집 목록을 초기화 했다네.');
          }).catch((error) => {
            console.log(error);
            message.channel.send('입력 시간이 지났으니 실행을 취소하겠네.');
          });
      });
    }
    case RECRUIT_MODE_SYNC: {
      const { getAuthClient, sheets } = require(`${global.dirname}/modules/spreadsheets.js`);
      const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);
      const authClient = await getAuthClient();
      let getOptions = {
        auth: authClient,
        spreadsheetId: sheetConfig.spreadsheet_id,
        range: '기록!W2:Y2'
      };
      const schema = (await sheets.spreadsheets.values.get(getOptions)).data.values;
      let sRoundNum = schema[0][0];
      let sBossNum = (schema[0][1])[0];
      let sRemainHp = schema[0][2];

      if(isNaN(parseInt(sRoundNum))) sRoundNum = 1;
      if(isNaN(parseInt(sBossNum))) sBossNum = 1;
      if(sRemainHp <= 0) {
        if(++sBossNum > 5) ++sRoundNum, sBossNum - 5;
        const hp = sRoundNum >= 11 ?
          [7000000, 9000000, 12000000, 14000000, 17000000] : [6000000, 8000000, 10000000, 12000000, 15000000];
        sRemainHp = hp[sBossNum-1];
      }

      bossState.boss_num = `${sRoundNum}-${sBossNum}`;
      bossState.remain_hp = sRemainHp;

      message.client.commands.get('실전').execute(message, ['확인']);
      break;
    }
    } // end of switch

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/config.json`, config);
  }
};
