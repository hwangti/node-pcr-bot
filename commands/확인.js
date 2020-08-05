const { getAuthClient, sheets } = require('../modules/spreadsheets.js');

module.exports = {
  name: '확인',
  summary: '클랜 시트의 전투 기록을 확인합니다.',
  description:
    '> `날짜`: 조회할 날짜를 지정합니다. `26(일)`, `어제`, `오늘` 등으로 입력합니다.\n' +
    '> `네임드`: 조회할 네임드 번호를 지정합니다. `1넴` 등으로 입력합니다.\n\n' +
    '- `@멘션`은 `@` 문자 입력 후 자동완성된 문자열로 사용해야 합니다.\n' +
    '- `@멘션`을 입력하지 않을 경우 메시지를 보낸 사람으로 설정됩니다.\n\n' +
    '- `출력개수`의 범위는 10 ~ 30 입니다.'
  ,
  usages: ['[날짜] [네임드] [@멘션=나|별명] [/출력개수=10]'],
  samples: ['', '@홍길동', '23일 5넴 홍길동 /25'],
  privileges: 1110,
  checkStrict: false,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);
    const linked_id = config.linked_id;

    if(!sheetConfig.spreadsheet_id)
      return message.channel.send('오류: 클랜 시트가 설정되지 않았습니다.');

    // 클랜 배틀 몇 일차인지 확인
    const dateObject = new Date(); // dateObject.setMonth(2); // @TODO 3월 임시
    if(dateObject.getHours() < 5) dateObject.setDate(dateObject.getDate() - 1);
    let dateOffset = dateObject.getDate() - new Date(config.clanbattle_start_time).getDate() + 1;
    if(dateOffset <= 0) dateOffset = 1;
    if(dateOffset > config.clanbattle_duration_day) dateOffset = config.clanbattle_duration_day;

    /* 매개 변수 처리 시작 */
    let paramDate = null;   // 날짜 조건 ([Date Object])
    let paramBoss = null;   // 보스 조건 (1, 2, 3, 4, 5)
    let paramMember = null; // 멤버 조건 (Discord memberId)
    let paramCount = 10;

    let argument = null;
    let errorString = '';

    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      // 날짜가 한글로 지정된 경우
      if(/^오늘$/.test(argument)) {
        paramDate = new Date(dateObject);
        continue;
      }
      if(/^어제$/.test(argument)) {
        paramDate = new Date(dateObject);
        paramDate.setDate(dateObject.getDate() - 1);
        continue;
      }

      // 날짜가 숫자로 지정된 경우
      if(/^[1-3][0-9]일?$/.test(argument)) {
        paramDate = new Date(dateObject);
        paramDate.setDate(parseInt(argument));
        continue;
      }

      // 네임드 번호가 지정된 경우
      if(/^[1-5]넴$/.test(argument)) {
        paramBoss = parseInt(argument);
        continue;
      }

      // 결과 개수가 지정된 경우
      if(/^\/[0-9]{2}$/.test(argument)) {
        paramCount = Math.max(10, Math.min(30, parseInt(argument.slice(1))));
        continue;
      }

      // 멤버 ID 처리 (@멘션 입력했을 경우)
      let match = null;
      if(paramMember == null && (match = argument.match(/^<@!?(\d{18,})>$/)) !== null) {
        paramMember = match[1];
        continue;
      }

      // 닉네임으로 추정되는 문자열 처리
      if(paramMember == null) {
        // 등록된 별명이 있다면 id 반환
        paramMember = Object.keys(linked_id).find(id => linked_id[id].aliases.includes(argument));
        if(paramMember != null) continue;
      }

      // 나머지 문자열은 미인식 처리
      errorString += `오류: 인식할 수 없는 문자열입니다. \`${argument}\`\n`;
    }

    if(errorString.length > 0)
      return message.channel.send(errorString);


    const displayName = paramMember != null ? verifiedName(paramMember, message) : null; // Discord 닉네임
    const sheetName   = paramMember != null ? linked_id[paramMember].primary   : null; // 시트 닉네임

    // 기록 시트 확인
    const botMessage = await message.channel.send('초기화 중... (1/3)');
    const authClient = await getAuthClient();
    let getOptions = {
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      range: sheetConfig.log_range
    };
    // 날짜별로 분할된 시트라면 현재 날짜에 맞게 시트 범위 수정
    if(sheetConfig.split_date === true)
      getOptions.range = getOptions.range.replace('{offset}', dateOffset);


    await botMessage.edit('시트 정보 불러오는 중... (2/3)');
    const logData = (await sheets.spreadsheets.values.get(getOptions)).data.values.reverse(); // 주의, Reverse
    const logLength = logData.length;
    let logArray = [];
    let matchCount = 0;

    const fullIdx = sheetConfig.log_full_idx;


    await botMessage.edit('조건 검색 중... (3/3)');
    for(let i=0; i<logLength; i++) {
      if(matchCount >= paramCount) break;

      // 닉네임이 없으면 무시
      if(['', '-'].includes(logData[i][fullIdx.nickname])) continue;

      // console.log(logData[i][fullIdx.date], ' ----- ', global.dateFormat(paramDate, sheetConfig.log_date_format));
      // 날짜 조건이 있고, 날짜와 일치하지 않으면 무시
      if( paramDate != null &&
        logData[i][fullIdx.date] !== global.dateFormat(paramDate, sheetConfig.log_date_format)
      )
        continue;

      // 보스 조건이 있고, 네임드 번호와 일치하지 않으면 무시
      // console.log(logData[i][fullIdx.boss].replace(/^\d-/, ''), ' ----- ' + paramBoss + ' ----- ' + config.boss_names[paramBoss]);
      if(paramBoss != null && logData[i][fullIdx.boss].replace(/^\d-/, '') !== config.boss_names[paramBoss-1])
        continue;

      // 멤버 조건이 있고, 해당 닉네임이 아니면 무시
      if(paramMember != null && logData[i][fullIdx.nickname] !== sheetName)
        continue;

      let logText = '-';
      // 양식 - ??회차 ?넴 [닉네임] [?,???,???] [이월]
      logText += ` ${logData[i][fullIdx.round].replace('회차', '')}회차`;
      logText += ` ${logData[i][fullIdx.boss].replace(/^\d-/, '')}`;
      // logText += ` ${paramBoss}넴`;
      logText += paramMember == null ? ` [${logData[i][fullIdx.nickname]}]` : '';
      logText += ` [${global.fn.numberFormat(logData[i][
        logData[i][fullIdx.deal_real] !== '' ? fullIdx.deal_real : fullIdx.deal_sum
      ])}]`;
      logText += (fullIdx.battle_type != null && logData[i][fullIdx.battle_type] !== '') ?
        ` [${logData[i][fullIdx.battle_type]}]` : '';
      logText += (fullIdx.is_kill != null && logData[i][fullIdx.is_kill] !== '') ?
        ` [격파 ${logData[i][fullIdx.is_kill]}초]` : '';
      logText += (fullIdx.is_bonus != null && logData[i][fullIdx.is_kill] === 'TRUE') ? '[이월]' : '';

      // 캐릭터 정보가 있으면 추가
      if(fullIdx.char_1 != null && logData[i][fullIdx.char_1] !== '') {
        logText += '\n［';
        logText += logData[i][fullIdx.char_1] + ' ';
        logText += logData[i][fullIdx.char_2] + ' ';
        logText += logData[i][fullIdx.char_3] + ' ';
        logText += logData[i][fullIdx.char_4] + ' ';
        logText += logData[i][fullIdx.char_5] + '］\n';
      }

      logText += '\n';
      logArray.push(logText);
      ++matchCount;
    }

    if(matchCount === 0)
      logArray.push('조건과 일치하는 기록이 없습니다.');

    let conditionText = '';
    conditionText += (paramDate !== null ? `- 날짜: ${global.dateFormat(paramDate, 'dd')}일\n` : '');
    conditionText += (paramBoss !== null ? `- 네임드: ${paramBoss}넴\n` : '');
    conditionText += (paramMember != null ? `- 닉네임: ${getDecoratedName(displayName, sheetName)}\n` : '');
    if(conditionText === '') conditionText = '- 최근 기록\n';
    conditionText += '\n';

    return botMessage.edit('', { embed: {
      color: '#0F9D58',
      author: {
        name: '전투 기록',
        icon_url: 'https://www.gstatic.com/images/branding/product/1x/sheets_16dp.png'
      },
      description:
        '** 🔹검색 조건 ** \n' + conditionText +
        `** 🔹결과 (${matchCount}건) **\n` + logArray.reverse().join('')
      ,
      footer: { text: '시트 기반 데이터' },
      timestamp: Date.now()
    }});
  }
};

function verifiedName(memberId, message) {
  // undefined 발생 예외 처리
  const confirmId = message.guild.member(memberId);

  return confirmId !== null ? confirmId.displayName : `<@!${memberId}>`;
}

function getDecoratedName(displayName, sheetName) {
  let string = '**`';
  string += (displayName !== sheetName) ? `${displayName}(${sheetName})` : displayName;
  string += '`**';

  return string;
}
