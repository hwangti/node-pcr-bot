/* eslint-disable indent */
const ALIAS_MODE_CHECK = 0;
const ALIAS_MODE_ADD = 11;
const ALIAS_MODE_CHANGE = 12;
const ALIAS_MODE_DELETE = 13;

module.exports = {
  name: '별명',
  summary: '봇과 클랜 시트에서 사용하는 별명을 관리합니다.',
  description:
    '> `확인`: 멤버(들)의 별명이나 사용 중인 별명을 확인합니다. `/all` 또는 `/모두`를 입력하면 별명을 등록한 멤버 전체를 보여줍니다.\n' +
    '> `등록`: 별명을 등록합니다. 첫 번째로 입력한 별명은 주 닉네임으로 설정되며, 시트 이름과 연동됩니다.\n' +
    '> `변경`: 주 닉네임(시트 이름)을 변경합니다.\n' +
    '> `삭제`: 별명을 삭제합니다. 주 닉네임은 삭제할 수 없으며, 별명을 입력하지 않았다면 등록된 별명을 전부 삭제합니다.\n\n' +
    '- `등록`, `삭제` 옵션 사용 시 별명을 여러 개 입력할 수 있습니다.\n' +
    '- 별명은 한글, 일본어, 한자, 영어와 일부 특수문자만 입력이 가능합니다.\n\n' +
    '- `닉네임`은 `@멘션`이나 등록된 별명을 사용할 수 있습니다.\n' +
    '- `닉네임`을 입력하지 않을 경우 메시지를 보낸 사람으로 설정됩니다.\n'
  ,
  aliases: ['닉네임', 'alias', 'nickname'],
  usages: ['<등록|삭제> <별명 ...> [@멘션=나|별명]', '확인 <별명 ...> [/all|/모두] [@멘션=나|별명]', '변경 <별명> [@멘션=나|별명]'],
  samples: ['확인 홍길동', '등록 홍길동 소설 @임꺽정 // 2개 등록', '변경 소설', '삭제 홍길동'],
  privileges: 1110,
  hasArgument: true,
  checkStrict: false,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    let linked_id = config.linked_id; // 정렬(재할당)해야해서 let으로 선언

    /* 매개 변수 처리 시작 */
    let mode = null;
    let modeCheckAll = false;
    let memberId = null;
    let nicknames = [];
    let errorString = '';

    let argument = null;
    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      // 기능 처리
      if(/^확인|등록|변경|삭제$/.test(argument)) {
        mode =
          (argument === '확인') ? ALIAS_MODE_CHECK :
          (argument === '등록') ? ALIAS_MODE_ADD :
          (argument === '변경') ? ALIAS_MODE_CHANGE : ALIAS_MODE_DELETE;
        continue;
      }

      if(/^\/(모두|미ㅣ|all)$/i.test(argument)) { // "미ㅣ" 는 all 한글로 친 것
        modeCheckAll = true;
        continue;
      }

      // 멤버 ID 처리 (@멘션 입력했을 경우)
      let match = null;
      if((match = argument.match(/^<@!?(\d{18,})>$/)) !== null) {
        memberId = match[1];
        continue;
      }

      // 별명 조건 필터링
      // 한글: \u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF
      // 일어: \u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF
      // 한자: \u2E80-\u2EFF\u31C0-\u31EF\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FBF\uF900-\uFAFF\u20000-\u2A6DF\u2F800-\u2FA1F
      if((/^[.,!?^\-()0-9A-Za-z\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u2E80-\u2EFF\u31C0-\u31EF\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FBF\uF900-\uFAFF\u20000-\u2A6DF\u2F800-\u2FA1F]+$/)
        .test(argument)
      ) {
        nicknames.push(argument);
        continue;
      }

      // 나머지 문자열은 미인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }

    // 발견된 오류 처리
    if(mode === null)
      errorString += '조수 군! 옵션을 지정해주게나. (`확인`, `등록`, `변경`, `삭제`)\n';

    if(errorString.length > 0)
      return message.channel.send(errorString);
    /* 매개 변수 처리 완료 */

    // 입력된 닉네임의 중복 제거 (by CID)
    nicknames = [...new Set(nicknames)];


    switch(mode) {
    case ALIAS_MODE_CHECK: {
      /*
        <확인> 옵션 조건
        - 확인 /all     // 멤버 전체 별명 정보 출력
        - 확인      // 메시지 작성자 정보 출력
        - 확인 @mension   // 멘션에 대한 정보 출력
        - 확인 alias ...  // 'alias'를 쓰는 사람에 대한 정보 출력
      */

      // 별명 모두 출력 확인
      if(modeCheckAll === true) {
        if(Object.keys(linked_id).length === 0)
          return message.channel.send('별명이 등록된 멤버가 없다네.');

        let aliasArray = [];
        Object.keys(linked_id).map(value => {
          aliasArray.push(
            (verifiedName(value, message) + ' [' + linked_id[value].primary + '] # ' + // 주 닉네임
            linked_id[value].aliases // 별명
              .filter(val => val !== linked_id[value].primary) // 주 닉네임은 제거
              .join(' ')
              .trim()
            ).replace(/# $/, '')
          );
        });
        aliasArray.sort(); // 이름 순으로 정렬

        return message.channel.send({ embed: {
          color: '#518FF5',
          title: `모든 별명 목록 (${aliasArray.length}명)`,
          description:
            '```ini\n디스코드 [주 닉네임] # 별칭\n```' +
            '```ini\n' + aliasArray.join('\n') + '\n```'
        }});
      }

      // 별명을 입력하지 않았다면
      if(nicknames.length === 0) {
        // @mension 있다면 @mension, 없다면 작성자 정보로 확인
        const confirmId = memberId === null ? message.author.id : memberId;

        if(Object.prototype.hasOwnProperty.call(linked_id, confirmId))
          return printNicknames(confirmId, message, linked_id);

        return message.channel.send('조수 군! 별명이 등록된 멤버가 아니라네.');
      }

      // 여기까지 왔다면 별명을 입력한 경우이므로, 단순 별명 검색
      let aliases = []; // '123456789012345678|별명|목록' 으로 저장되는 1차원 배열
      Object.keys(linked_id).map(value => aliases.push(value + '|' + linked_id[value].aliases.join('|') + '|'));
      let matchCount = 0;

      // 확인할 별명 갯수만큼 루프
      nicknames.forEach(nickname => {
        const searchArray = aliases.filter(items => items.toLowerCase().indexOf(`|${nickname}|`) > -1);

        if(searchArray.length > 0) {
          ++matchCount;
          return printNicknames(searchArray.toString().split('|')[0], message, linked_id);
        }
      });

      if(matchCount === 0)
        return message.channel.send('조수 군! 사용 중인 별명이 아니라네.');
      return;
    }
    case ALIAS_MODE_ADD: {
      if(memberId === null) memberId = message.author.id;

      if(nicknames.length === 0)
        return message.channel.send('조수 군! 별명을 입력하지 않았다네.');

      // 별명 중복 확인
      const matchId = Object.keys(linked_id).find(key => {
        return linked_id[key].aliases.find(value => nicknames.includes(value));
      });

      // 중복일 경우 오류 메시지 출력
      if(matchId !== undefined)
        return message.channel.send(`조수 군! **\`${verifiedName(matchId, message)}\`** 군이 사용 중인 별명이라네.`);

      // 등록되지 않은 멤버라면 등록
      if(Object.prototype.hasOwnProperty.call(linked_id, memberId) === false) {
        linked_id[memberId] = { primary: nicknames[0], aliases: nicknames };
        // linked_id = Object.fromEntries(Object.entries(linked_id).sort());
      } else {
        // 중복 체크했으니 배열 병합
        linked_id[memberId].aliases = linked_id[memberId].aliases.concat(nicknames);
      }

      printNicknames(memberId, message, linked_id, '별명을 등록했다네.');
      break;
    }
    case ALIAS_MODE_CHANGE: {
      if(memberId === null) memberId = message.author.id;

      if(nicknames.length === 0)
        return message.channel.send('조수 군! 별명을 입력하지 않았다네.');

      if(Object.prototype.hasOwnProperty.call(linked_id, memberId) === false)
        return message.channel.send('조수 군! 별명이 등록된 멤버가 아니라네.');

      // 별명 중복 확인
      const matchId = Object.keys(linked_id).find(value => linked_id[value].aliases.includes(nicknames[0]));
      if(matchId !== undefined && matchId !== memberId) // 작성자의 별명 목록에 있다면 바꿔도 됨
        return message.channel.send(`조수 군! **\`${verifiedName(matchId, message)}\`** 군이 사용 중인 별명이라네.`);

      // 주 닉네임 변경
      linked_id[memberId].primary = nicknames[0];

      // 별명에 없는 닉네임이라면 별명 목록에 추가
      if(linked_id[memberId].aliases.includes(nicknames[0]) === false)
        linked_id[memberId].aliases.push(nicknames[0]);

      printNicknames(memberId, message, linked_id, '별명을 변경했다네.');
      break;
    }
    case ALIAS_MODE_DELETE: {
      if(memberId === null) memberId = message.author.id;

      if(Object.prototype.hasOwnProperty.call(linked_id, memberId) === false)
        return message.channel.send('조수 군! 별명이 등록된 멤버가 아니라네.');

      // 닉네임에 입력된 목록이 없으면 초기화
      if(nicknames.length === 0) {
        delete linked_id[memberId];
        message.channel.send(`**\`${verifiedName(memberId, message)}\`** 군의 별명을 모두 삭제했다네.`);
        // linked_id[memberId].aliases = [linked_id[memberId].primary]; // 변경 닉네임은 삭제 불가
      } else {
        if(nicknames.includes(linked_id[memberId].primary) === true)
          return message.channel.send('조수 군! 삭제하려는 별명에 주 닉네임이 포함되어 있군.');

        // 입력된 별명들을 삭제
        linked_id[memberId].aliases = linked_id[memberId].aliases.filter(value => {
          return value === linked_id[memberId].primary || !nicknames.includes(value);
        });

        printNicknames(memberId, message, linked_id, '별명을 삭제했다네.');
      }
      break;
    } /* end of case */
    } /* end of switch */

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${__dirname}/../config/${message.guild.id}/config.json`, config);
  }
};

function verifiedName(memberId, message) {
  // undefined 발생 예외 처리
  const confirmId = message.guild.member(memberId);

  return confirmId !== null ? confirmId.displayName : `<@!${memberId}>`;
}

function printNicknames(memberId, message, linked_id, text) {
  return message.channel.send(text, { embed: {
    color: '#518FF5',
    title: `\`${verifiedName(memberId, message)}\` 군의 별명 목록`,
    // .setTitle(`<@!${memberId}>님의 별명 목록`) // 안됨
    fields: [
      {
        name: '주 닉네임 (시트)',
        value: linked_id[memberId].primary
      },
      {
        name: `별칭 (${linked_id[memberId].aliases.length})`,
        value: linked_id[memberId].aliases.join(', ')
      }
    ]
  }});
}
