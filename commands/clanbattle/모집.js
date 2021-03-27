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
      if((match = argument.match(/^([0-9]{3,9})만?$/)) !== null) {
        remainHp = parseInt(match[0]);
        if(remainHp <= 11000) remainHp *= 10000;
        continue;
      }

      // 나머지 문자열은 미 인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }

    // 발견된 오류 처리
    if(mode === RECRUIT_MODE_SET && namedNumber === null)
      errorString += '조수 군! 네임드 정보를 말해주게나. (예: `4` 또는 `24-4`)\n';
    if(mode === RECRUIT_MODE_SET && remainHp === null)
      errorString += '조수 군! 잔여 보스 HP 정보를 말해주게나. (예: `1200` 또는 `2000만`)\n';

    if(errorString.length > 0)
      return message.channel.send(errorString);
    /* 매개 변수 처리 완료 */


    // 모집 정보 설정
    switch(mode) {
    case RECRUIT_MODE_CHECK: {
      message.content = config.prefix + '실전 확인';
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

              message.content = `${config.prefix}호출 ${namedNumber}`;
              await message.client.commands.get('호출').execute(message, ['/U', `${namedNumber}`]);
              this.execute(message, ['확인']);
            }).catch(() => {
              message.channel.send('입력 시간이 지났으니 실행을 취소하겠네.');
            });
        });

      bossState = Object.assign(bossState, { boss_num: namedNumber, remain_hp: remainHp, entries: {} });

      message.content = `${config.prefix}호출 ${namedNumber}`;
      await message.client.commands.get('호출').execute(message, ['/U', `${namedNumber}`]);
      this.execute(message, ['확인']);
      break;
    }
    case RECRUIT_MODE_MODIFY: {
      if(!bossState.boss_num) // || !bossState.remain_hp)
        return message.channel.send('조수 군! 모집부터 해야한다네.');

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
            delete message.client[`actualBattleMsgLastId_${message.guild.id}`];
            global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/config.json`, config);
            message.channel.send('모집 목록을 초기화 했다네.');
          }).catch(() => {
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
        range: sheetConfig.boss_info_range
      };
      const schema = (await sheets.spreadsheets.values.get(getOptions)).data.values;
      let sRoundNum = parseInt(schema[0][sheetConfig.boss_info_idx.round]);
      let sBossNum = schema[0][sheetConfig.boss_info_idx.boss];
      let sRemainHp = parseInt(String(schema[0][sheetConfig.boss_info_idx.remain_hp]).replace(/,/g, ''));
      if(config.sheet_type === 'RIMA') // 꼬아 시트는 두번째 줄에 체력이 있음
        sRemainHp = parseInt(String(schema[1][sheetConfig.boss_info_idx.remain_hp]).replace(/,/g, ''));

      if(isNaN(sRoundNum)) sRoundNum = 1;
      if(/^[1-5]$/.test(sBossNum)) {
        sBossNum = parseInt(sBossNum);
      } else {
        sBossNum = String(sBossNum).replace(/ /g, '').trim();
        const bossNames = [
          ['팀', '미노타', '트윈', '키노스', '레온', '메두사', '메듀사', '글러튼', '톤', '레사스', '사지', '게티', '리오스', '페돈'],
          ['베어', '스피릿', '사이클롭스', '사클', '무버', '무바', '타이탄', '티타노', '테리온', '트라이', '울프', '가고일', '센리', '옵시디언'],
          ['니들', '오크', '라이덴', '레이스', '메가', '마담', '무슈', '드레이크', '왈큐레', '발키리', '시프'],
          ['그리핀', '라이', '랜드'],
          ['와이번', '고블린'],
        ];
        for(let i=0; i<5; i++) {
          if(bossNames[i].some(name => sBossNum.indexOf(name) !== -1) === true) {
            sBossNum = 5 - i;
            break;
          }
        }
      }

      if(isNaN(parseInt(sBossNum))) sBossNum = 1;
      if(isNaN(sRemainHp)) sRemainHp = 1;

      if(sRemainHp <= 0) {
        if(++sBossNum > 5) ++sRoundNum, sBossNum - 5;
        let hp = 0;
        switch(true) {
        case sRoundNum <= 10:
          hp = [6000000, 8000000, 10000000, 12000000, 15000000];
          break;

        case config.server_type === 'KR' || sRoundNum <= 34:
          hp = [7000000, 9000000, 13000000, 15000000, 20000000];
          break;

        case config.server_type === 'JP' && sRoundNum <= 44:
          hp = [17000000, 18000000, 20000000, 21000000, 23000000];
          break;

        default:
          hp = [85000000, 90000000, 95000000, 100000000, 110000000];
        }
        sRemainHp = hp[sBossNum-1];
      }

      bossState.boss_num = `${sRoundNum}-${sBossNum}`;
      bossState.remain_hp = sRemainHp;

      message.content = config.prefix + '실전 확인';
      message.client.commands.get('실전').execute(message, ['확인']);
      break;
    } // end of case
    } // end of switch

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/config.json`, config);
  }
};
