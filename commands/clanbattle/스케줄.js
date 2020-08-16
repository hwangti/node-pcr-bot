const { getAuthClient, sheets } = require(`${global.dirname}/modules/spreadsheets.js`);

/* eslint-disable indent */
const SCHEDULE_MODE_CHECK = 0;
const SCHEDULE_MODE_FINISH = 11;
const SCHEDULE_MODE_CUSTOM = 12;

const MEMO_PARSE_IDLE = 0;
const MEMO_PARSE_ING = 1;

module.exports = {
  name: '스케줄', // 시트연동 Ver.
  category: 'clanbattle',
  summary: '클랜 시트와 연동되는 스케줄표를 관리합니다.',
  description:
    '> `확인`: 스케줄표를 확인합니다.\n' +
    '> `완료`: 타격 후 스케줄표에 완료 처리할 때 사용하는 옵션입니다.\n' +
    '> `변경`: 스케줄표 입력을 원하는 내용으로 변경할때 사용하는 옵션입니다.\n\n' +
    '> `1군` ... `3군`: 클랜 시트의 스케줄표에서 좌측부터 1군, 2군, 3군 파티입니다.\n' +
    '> `1넴` ... `5넴`: 네임드 보스로 파티를 지정할 수 있습니다. (라이라이=2넴 등)\n\n' +
    '- 명령어 순서와 관계없이 입력 가능합니다. (닉네임이 제일 앞에 나와도 가능)\n' +
    '- 같은 보스를 두 번 이상 타격하는 경우 "넴" 옵션은 사용할 수 없습니다. (몇 군인지 판단 불가)\n' +
    '- `닉네임`은 `@멘션`이나 등록된 별명을 사용할 수 있습니다.\n' +
    '- `닉네임`을 입력하지 않을 경우 메시지를 보낸 사람으로 설정됩니다.'
  ,
  aliases: ['일정', '스케쥴', 'schedule'],
  usages: ['확인 [@멘션=나|별명]', '완료 <1군|2군|3군> [@멘션=나|별명]', '완료 <1넴|...|5넴> [@멘션=나|별명]'],
  samples: ['확인 @홍길동', '완료 1군', '완료 5넴 @홍길동'],
  privileges: 1110,
  hasArgument: true,
  checkStrict: false,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);
    const linked_id = config.linked_id;

    let mode = null;
    let argument = null;

    let memberId = null;
    let partyString = null;
    let memo = '';
    let memoPrefix = MEMO_PARSE_IDLE;
    let errorString = '';

    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      let match = null;

      // 기능 처리
      if(/^확인|완료|변경|수동$/.test(argument)) {
        mode =
          (argument === '확인') ? SCHEDULE_MODE_CHECK :
          (argument === '완료') ? SCHEDULE_MODE_FINISH : SCHEDULE_MODE_CUSTOM;
        continue;
      }

      // 메모 처리 (공백 없는 경우)
      if((match = argument.match(/^["']([!%&()*+,\-.:;<=>?_~0-9A-Za-zㄱ-ㅎㅏ-ㅣ가-힣]*)["']$/)) !== null) {
        memo = match[1];
        continue;
      }

      // 메모 처리 (공백 있는 경우)
      if((match = argument.match(/^["']([!%&()*+,\-.:;<=>?_~0-9A-Za-zㄱ-ㅎㅏ-ㅣ가-힣]+)$/)) !== null)
        memoPrefix = MEMO_PARSE_ING;
      if(memoPrefix === MEMO_PARSE_ING) {
        memo = (memo + ' ' + argument.replace(/["']/, '')).trim();

        if((match = argument.match(/["']$/)) !== null)
          memoPrefix = MEMO_PARSE_IDLE;
        continue;
      }

      // 타격 완료 처리할때 파티 위치 처리
      if(/^[1-3]군|[1-5]넴$/.test(argument)) {
        partyString = argument;
        continue;
      }

      // 멤버 ID 처리 (@멘션 입력했을 경우)
      if((match = argument.match(/^<@!?(\d{18,})>$/)) !== null) {
        memberId = match[1];
        continue;
      }

      // 닉네임으로 추정되는 문자열 처리
      if(memberId == null) {
        // 등록된 별명이 있다면 id 반환
        memberId = Object.keys(linked_id).find(id => linked_id[id].aliases.includes(argument));
        if(memberId != null) continue;
      }

      // 나머지 문자열은 미 인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }
    if(memberId == null)
      memberId = message.author.id;

    // 발견된 오류 처리
    if(config.sheet_type !== 'MOMO')
      errorString += '조수 군! 이 서버에서는 사용할 수 없는 명령어라네.\n';
    if(!sheetConfig.spreadsheet_id)
      errorString += '조수 군! 먼저 클랜 시트를 설정해주게나.\n';
    if(mode === null)
      errorString += '조수 군! 옵션을 지정해주게나. (`확인`, `완료`)\n';
    if(mode === SCHEDULE_MODE_CUSTOM && memo === '')
      errorString += '조수 군! 변경할 내용을 입력해주게나.\n';
    if(mode === SCHEDULE_MODE_FINISH && partyString === null)
      errorString += '조수 군! 군(1~3군) 또는 네임드를 입력해주게나. (예: `4넴`)\n';
    if(linked_id[memberId] == null)
      errorString += '조수 군! 별명이 등록된 멤버가 아니라네.\n';

    if(errorString.length > 0)
      return message.channel.send(errorString);


    const displayName = verifiedName(memberId, message); // Discord 닉네임
    const sheetName = linked_id[memberId].primary;     // 시트 닉네임
    const processTotal = mode === SCHEDULE_MODE_CHECK ? 2 : 3;

    // 시트에서 스케줄표 불러오기
    const botMessage = await message.channel.send(`초기화 중이라네... (1/${processTotal})`);
    const authClient = await getAuthClient();
    let getOptions = {
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      range: '★스케줄표★!B6:F35'
    };

    botMessage.edit(`시트 정보를 불러오는 중이라네... (2/${processTotal})`);
    const scheduleData = (await sheets.spreadsheets.values.get(getOptions)).data.values;

    // @TODO const 처리 시작 (나중에 config 파일에 반영)
    const scheduleIdx = {};
    scheduleIdx.nickname = 0;
    scheduleIdx.party1 = 1;
    scheduleIdx.party2 = 2;
    scheduleIdx.party3 = 3;
    scheduleIdx.kmr_state = 4;
    // @TODO const 처리 완료

    const findRowNum = Object.keys(scheduleData).findIndex(
      index => sheetName === scheduleData[index][scheduleIdx.nickname].trim()
    );

    if(findRowNum === -1)
      return botMessage.edit(`조수 군! 시트에서 \`${sheetName}\` 군을 찾을 수 없었다네.`);

    /* 작업 처리 시작 */
    const embed = {
      color: '#0F9D58',
      footer: { text: '시트 기반 데이터' },
      timestamp: Date.now(),
      fields: []
    };
    switch(mode) {
    case SCHEDULE_MODE_CHECK: {
      embed.author = {
        name: `${getDecoratedName(displayName, sheetName)}님의 스케줄표`,
        icon_url: 'https://www.gstatic.com/images/branding/product/1x/sheets_16dp.png'
      };

      let partyString = '';
      for(let i=1; i<=3; i++)
        partyString += `**\`${i}군\`** - ${scheduleData[findRowNum][i]}\n`;
      partyString += scheduleData[findRowNum][scheduleIdx.kmr_state] === 'TRUE' ? '\n키무라 찬스를 사용했다네.' : '';

      embed.fields.push({ name: '파티 목록', value: partyString });
      return botMessage.edit('', { embed: embed });
    }
    case SCHEDULE_MODE_FINISH:
    case SCHEDULE_MODE_CUSTOM: {
      const rangePattern = /^(.+)!([A-Z]+)(\d+):([A-Z]+)(\d+)+$/;
      const startRowNum = parseInt(getOptions.range.replace(rangePattern, '$3'));
      const updateRange = getOptions.range.replace(
        rangePattern, `$1!$2${startRowNum+findRowNum}:$4${startRowNum+findRowNum}`
      );

      let setOptions = {
        auth: authClient,
        spreadsheetId: sheetConfig.spreadsheet_id,
        valueInputOption: 'USER_ENTERED',
        includeValuesInResponse: true,
        range: updateRange,
        resource: { values: [] }
      };
      setOptions.resource.values[0] = Array(scheduleIdx.kmr_state+1).fill(null);

      const schedulePattern = /^([1-3])단? ?([1-5])넴?(.+)$/;
      let partyPosition = 0;
      let partyCount = 0;

      // 파티 위치가 "군" 으로 입력된 경우
      if(partyString.includes('군')) {
        partyPosition = parseInt(partyString[0]); // 1~3군에서 첫 번째 문자열 추출하고 숫자로 변환
        partyCount = 1;
      } else {
        const named = parseInt(partyString[0]); // 1~5넴에서 첫번째 문자열 추출하고 숫자로 변환

        // 해당 네임드가 몇 군에 속해있는지 찾음
        for(let i=1; i<=3; i++) {
          const match = scheduleData[findRowNum][i].match(schedulePattern);
          if(match !== null && parseInt(match[2]) === named) {
            partyPosition = i;
            ++partyCount;
          }
        }

        // 파티를 찾지 못한 경우
        if(partyPosition === 0)
          return botMessage.edit(`조수 군! 스케줄표에서 ${named}넴 파티를 찾을 수 없었다네.`);

        // 해당 네임드가 여러 개 있는 경우 어떤 파티인지 확인할 수 없음
        if(partyCount > 1)
          return botMessage.edit(`조수 군! ${named}넴 파티가 모호하니 1군 2군 3군 등으로 입력해주게나.`);
      }

      // 중복 완료 처리 방지
      if(mode === SCHEDULE_MODE_FINISH) {
        if(scheduleData[findRowNum][partyPosition].includes('완'))
          return botMessage.edit(
            '조수 군! 이미 완료 처리된 파티라네.\n완료 처리된 파티는 `변경` 옵션으로 수정해주게나.\n' +
            `${partyPosition}군:\n\`\`\`yaml\n${scheduleData[findRowNum][partyPosition]}\`\`\``);

        memo = scheduleData[findRowNum][partyPosition].replace(
          schedulePattern, memo === '' ? '$1$2 완' : memo);
      } else {
        memo = scheduleData[findRowNum][partyPosition].replace(schedulePattern, memo);
      }

      botMessage.edit(`스케줄표 완료 처리 중이라네... (3/${processTotal})`);

      setOptions.resource.values[0][partyPosition] = memo;
      await sheets.spreadsheets.values.update(setOptions);

      return botMessage.edit(
        `${getDecoratedName(displayName, sheetName)} 군의 스케줄표 처리 완료:\n\`\`\`yaml\n` +
        `${scheduleData[findRowNum][partyPosition]} => ${memo}` +
        '```');
    } /* end of case */
    } /* end of switch */
  } /* end of execute() */
};

function verifiedName(memberId, message) {
  // undefined 발생 예외 처리
  const confirmId = message.guild.member(memberId);

  return confirmId !== null ? confirmId.displayName : `<@!${memberId}>`;
}

function getDecoratedName(displayName, primary) {
  let string = '';
  string += (displayName !== primary) ? `${displayName}(${primary})` : displayName;
  string += '';

  return string;
}
