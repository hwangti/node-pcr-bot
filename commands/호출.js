/* eslint-disable indent */
const CALL_MODE_NONE = 0;
const CALL_MODE_CHECK = 1;
const CALL_MODE_CALL = 2;
const CALL_MODE_ADD = 11;
const CALL_MODE_DELETE = 12;
const CALL_MODE_MEMO = 13;
const CALL_MODE_RESET = 14;

const MEMO_PARSE_IDLE = 0;
const MEMO_PARSE_ING = 1;

module.exports = {
  name: '호출',
  summary: '참전할 보스의 등록 및 삭제와 호출을 관리합니다.',
  description:
    '> `확인`: 호출 등록된 멤버 정보를 조회합니다. `네임드_정보`가 입력되지 않았다면 전체를 조회합니다.\n' +
    '> `호출`: 호출 등록된 멤버에게 멘션을 보냅니다. `네임드_정보`를 입력해야 합니다.\n' +
    '> `등록`: 참전할 보스에 등록합니다.\n' +
    '> `삭제`: 등록된 네임드 정보를 삭제합니다. `/모두` 또는 `/all`을 입력하면 해당 네임드 정보 전체를 삭제합니다.\n' +
    '> `메모`: 등록한 네임드 정보에 메모를 입력합니다. 메모는 따옴표 (\' 또는 " 로 감싸야 합니다.)\n' +
    '> `리셋`, `초기화`: **`모든`** 네임드 정보를 삭제합니다. (봇의 질문에 추가로 `/yes` 입력 필요)\n\n' +
    '- 옵션을 입력하지 않으면 `호출` 명령으로 설정됩니다.\n\n' +
    '- `네임드_정보`는 보스 번호 또는 회차 정보 있는 보스 번호 모두 가능합니다.\n' +
    '(예: `4`, `24-4` => 4넴 또는 24회차 4넴)\n\n' +
    '- `@멘션`은 `@` 문자 입력 후 자동완성된 문자열로 사용해야 합니다.\n' +
    '- `@멘션`을 입력하지 않을 경우 메시지를 보낸 사람으로 설정됩니다.'
  ,
  aliases: ['예약', 'call'],
  usages: ['<확인|호출|등록|삭제> <네임드_정보> [@멘션=나|별명] ["메모"] [/모두|/all]', '<리셋|초기화>'],
  samples: ['등록 24-4', '삭제 24-4 @홍길동', '확인', '호출 24-4'],
  privileges: 1110,
  hasArgument: true,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const linked_id = config.linked_id;
    const bossNames = config.boss_names;
    let callState = config.call_state;

    /* 매개 변수 처리 시작 */
    let mode = null;
    let namedNumber = null;
    let deleteAll = false;
    let entries = [];

    let argument = null;
    let entryIndex = -1;
    let memoPrefix = MEMO_PARSE_IDLE;
    let errorString = '';
    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      let match = null;

      // 따옴표 처리 (메모)
      if(/["']/.test(argument))
        memoPrefix = MEMO_PARSE_ING;

      if(memoPrefix === MEMO_PARSE_IDLE) {
        // 기능 처리
        if(/^확인|호출|등록|삭제|메모|리셋|초기화$/.test(argument)) {
          mode =
            (argument === '확인') ? CALL_MODE_CHECK :
            (argument === '호출') ? CALL_MODE_CALL :
            (argument === '등록') ? CALL_MODE_ADD :
            (argument === '삭제') ? CALL_MODE_DELETE :
            (argument === '메모') ? CALL_MODE_MEMO :
            (argument === '리셋') ? CALL_MODE_RESET :
            (argument === '초기화') ? CALL_MODE_RESET : CALL_MODE_NONE;
          continue;
        }

        // 네임드 정보로 추정되는 문자열 처리 (1 ... 5, 24-4 둘 다 처리)
        if((match = argument.match(/^(([1-9][0-9]?)-)?([1-5])넴?$/)) !== null) {
          namedNumber = match[0];
          continue;
        }

        // 일괄 삭제 명령 확인 (/모두, /all)
        if(/^\/(모두|미ㅣ|all)$/i.test(argument)) { // "미ㅣ" 는 all 한글로 친 것
          deleteAll = true;
          continue;
        }

        // 멤버 ID 처리 (@멘션 입력했을 경우)
        if((match = argument.match(/^<@!?(\d{18,})>$/)) !== null) {
          if(entries[entryIndex] == null) {
            entries.push({ id: '', memo: '' });
            ++entryIndex;
          }

          if(entries[entryIndex].id == '') {
            entries[entryIndex].id = match[1];
          } else {
            entries.push({ id: match[1], memo: '' });
            ++entryIndex;
          }
          continue;
        }

        // 닉네임으로 추정되는 문자열 처리
        const memberId = Object.keys(linked_id).find(id => linked_id[id].aliases.includes(argument));
        if(memberId !== undefined) {
          if(entries[entryIndex] == null) {
            entries.push({ id: '', memo: '' });
            ++entryIndex;
          }

          if(entries[entryIndex].id == '') {
            entries[entryIndex].id = memberId;
          } else {
            entries.push({ id: memberId, memo: '' });
            ++entryIndex;
          }
          continue;
        }
      }
      /* 일반적인 처리 */

      // 메모 처리 (공백 있는 경우)
      if(
        memoPrefix === MEMO_PARSE_ING &&
        ((match = argument.match(/^["']?([!%&()*+,\-.:;<=>?_~0-9A-Za-zㄱ-ㅎㅏ-ㅣ가-힣]+)["']?$/)) !== null)
      ) {
        if(entries[entryIndex] == null) {
          entries.push({ id: '', memo: '' });
          ++entryIndex;
        }

        entries[entryIndex].memo = (entries[entryIndex].memo + ' ' + match[1]).trim();

        if(/["']$/.test(argument))
          memoPrefix = MEMO_PARSE_IDLE;
        continue;
      }

      // 나머지 문자열은 미 인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }

    // 작업이 지정되지 않았으면 호출 명령으로 설정
    if(mode === null) mode = CALL_MODE_CALL;
    // 멤버가 지정되지 않았으면 작성자로 설정
    if(entries.length === 0) entries.push({ id: message.author.id, memo: '' });
    if(entries[0].id === '') entries[0].id = message.author.id;

    // 발견된 오류 처리
    if(mode === null)
      errorString += '조수 군! 옵션을 입력해주게나. (`확인`, `호출`, `등록`, `삭제`)\n';
    if([CALL_MODE_CHECK, CALL_MODE_RESET].includes(mode) === false && namedNumber === null)
      errorString += '조수 군! 네임드 정보를 입력해주게나. (예: `24-4`)\n';

    if(errorString.length > 0)
      return message.channel.send(errorString);
    /* 매개 변수 처리 완료 */


    switch(mode) {
    case CALL_MODE_CHECK: {
      let callString = '';

      for(const key in callState) {
        // 네임드 정보가 입력되었다면 해당 정보만 출력
        if(namedNumber !== null && key !== namedNumber) continue;

        // 등록된 멤버가 없으면 무시
        if(callState[key].length === 0) continue;

        callString += `**\`${key}\`** \`(${callState[key].length}명)\` - `;
        callString += callState[key].map(entry => {
          let string = `<@!${entry.id}>`;
          if(entry.memo !== '') string += `(${entry.memo})`;
          return string;
        }).join(' ') + '\n';
      }

      if(callString.length < 10)
        return message.channel.send('호출 등록된 멤버가 없다네.');

      return message.channel.send({ embed: {
        color: '#518FF5',
        title: '호출 명단 확인',
        description: callString
      }});
    }
    case CALL_MODE_CALL: {
      if(namedNumber === null)
        return message.channel.send('조수 군! 호출할 네임드 정보가 없다네. (예: `24-4`)');

      if( Object.keys(callState).length === 0 ||
        !callState[namedNumber] || callState[namedNumber].length === 0
      )
        return message.channel.send('조수 군! 호출할 명단이 없다네.');

      for(const key in callState) {
        // 특정 네임드 정보가 입력되었다면 그것만 출력하게끔 함
        if(namedNumber !== null && key !== namedNumber) continue;

        const match = key.match(/^(([1-9][0-9]?)-)?([1-5])넴?$/);
        const namedString = match.length === 4 ?
          ' (' + (match[2] ? `${match[2]}회차 ` : '') + bossNames[parseInt(match[3])-1] + ')' : '';

        return message.channel.send( // embed 에서는 멘션이 가지 않음
          `**호출: \`${key}\`${namedString}** 명단 (${callState[key].length}명)\n> ` +
          callState[key].map(entry => entry.id).join('  ').replace(/(\d{18,})/g, '<@!$1>')
        );
      }

      return message.channel.send('조수 군! 호출할 명단이 없다네. (ERR 1)');
    }
    case CALL_MODE_ADD: {
      // 네임드 정보가 존재하지 않으면 등록
      if((namedNumber in callState) === false) {
        callState[namedNumber] = [];

        if(Object.keys(callState).length > 1)
          callState = global.fn.sortObject(callState); // 정렬
      }

      let addCount = 0;
      for(const e in entries) {
        let isExists = false;
        for(const n in callState[namedNumber]) {
          if(entries[e].id === callState[namedNumber][n].id) {
            isExists = true;
            break;
          }
        }

        if(isExists === false) {
          callState[namedNumber].push(entries[e]);
          ++addCount;
        }
      }

      if(addCount === 0)
        return message.channel.send('조수 군! 이미 등록되어 있다네.');

      message.channel.send('등록 완료' +
        (entries.length > 1 ? ` (${entries.length}명 중 ${addCount}명)` : ''));
      this.execute(message, ['확인', namedNumber]);
      break;
    }
    case CALL_MODE_DELETE: {
      // 보스가 존재하지 않는 경우
      if(namedNumber in callState === false)
        return message.channel.send('조수 군! 네임드 정보를 찾을 수 없다네.');

      // 일괄 삭제 기능
      if(deleteAll === true) {
        delete callState[namedNumber];
        message.channel.send(`일괄 삭제 완료: \`${namedNumber}\``);
        break;
      }

      // 호출 정보 삭제
      let length = callState[namedNumber].length;
      callState[namedNumber] = callState[namedNumber].filter(entry => {
        let isExists = false;
        for(const e in entries) {
          if(entries[e].id === entry.id) {
            isExists = true;
            break;
          }
        }
        return !isExists; // inverse
      });

      length -= callState[namedNumber].length;

      // 삭제 후 엔트리가 없다면 네임드 정보도 제거
      if(callState[namedNumber].length === 0)
        delete callState[namedNumber];

      if(length === 0)
        return message.channel.send('조수 군! 호출 명단에 등록되어 있지 않다네.');

      message.channel.send('삭제 완료' +
        (entries.length > 1 ? ` (${entries.length}명 중 ${length}명)` : ''));
      this.execute(message, ['확인', namedNumber]);
      break;
    }
    case CALL_MODE_MEMO: {
      // 보스가 존재하지 않는 경우
      if(namedNumber in callState === false)
        return message.channel.send('조수 군! 네임드 정보를 찾을 수 없다네.');

      if(entries.length > 1)
        return message.channel.send('조수 군! 메모는 한 명씩 변경 가능하다네. (오조작 방지)');

      let modifyCount = 0;
      for(const e in entries) {
        for(const n in callState[namedNumber]) {
          if(entries[e].id === callState[namedNumber][n].id) {
            if(entries[0].memo === '') {
              return message.channel.send(
                '변경할 메모를 입력해주게, 조수 군!\n' +
                '메모를 삭제하려면 `ㅇㅇ`, 실행을 취소하려면 `ㄴㄴ` 를 쓰면 된다네. (30초 이내)')
              .then(() => {
                const filter = m => message.author.id === m.author.id;

                message.channel
                  .awaitMessages(filter, { time: 30000, max: 1, errors: ['time'] })
                  .then(async messages => {
                    if(['ㄴㄴ'].includes(messages.first().content.trim()))
                      return message.channel.send('실행을 취소했다네.');

                    if(['ㅇㅇ'].includes(messages.first().content.trim())) {
                      callState[namedNumber][n].memo = '';
                      message.channel.send('메모를 삭제했다네.');
                    } else {
                      callState[namedNumber][n].memo =
                        messages.first().content.replace(/[\n\r"#$'/@\\^|]/g, '').trim();
                      message.channel.send('메모를 변경했다네.');
                    }

                    this.execute(message, ['확인', namedNumber]);
                    global.fn.saveConfig(`${__dirname}/../config/${message.guild.id}/config.json`, config);
                  }).catch(() => {
                    message.channel.send('입력 시간이 지났으니 실행을 취소하겠네.');
                  });
              });
            }

            callState[namedNumber][n].memo = entries[e].memo;
            ++modifyCount;
            break;
          }
        }
      }

      if(modifyCount === 0)
        return message.channel.send('조수 군! 호출 명단에 등록되어 있지 않다네.');

      message.channel.send('메모 변경 완료' +
        (entries.length > 1 ? ` (${entries.length}명 중 ${modifyCount}명)` : ''));
      this.execute(message, ['확인', namedNumber]);
      break;
    }
    case CALL_MODE_RESET: {
      return message.channel.send(
        '경고: 모든 호출 목록을 초기화하려고 하는건가, 조수 군?\n' +
        '맞으면 10초 이내로 `/yes` 를 입력하게나. (10초 이내)'
      ).then(() => {
        const filter = m => message.author.id === m.author.id;

        message.channel
          .awaitMessages(filter, { time: 10000, max: 1, errors: ['time'] })
          .then(async messages => {
            if(messages.first().content.trim() !== '/yes')
              return message.channel.send('실행을 취소했다네.');

            for(const n in callState) delete callState[n];
            message.channel.send('호출 목록을 초기화했다네.');

            global.fn.saveConfig(`${__dirname}/../config/${message.guild.id}/config.json`, config);
          }).catch(() => {
            message.channel.send('입력 시간이 지났으니 실행을 취소하겠네.');
          });
      });
    } /* end of case */
    } /* end of switch */

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${__dirname}/../config/${message.guild.id}/config.json`, config);
  }
};
