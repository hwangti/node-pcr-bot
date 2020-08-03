const { getAuthClient, sheets } = require('../modules/spreadsheets.js');

/* eslint-disable indent */
const KMR_MODE_CHECK = 0;
const KMR_MODE_STATUS = 1;
const KMR_MODE_USE = 10;
const KMR_MODE_CANCEL = 11;
const KMR_MODE_RESET = 12;

module.exports = {
  name: '키무라', // 시트연동 Ver.
  summary: '클랜 시트와 연동되는 키무라 찬스(1일 1회 강종 기능)를 관리합니다.',
  description:
    '> `사용`: 키무라 찬스를 사용할때 쓰는 옵션입니다.\n' +
    '> `취소`: 키무라 찬스를 잘못 등록했을 경우 되돌리는 옵션입니다.\n' +
    '> `확인`: 특정 멤버가 키무라 찬스를 사용했는지를 조회합니다.\n' +
    '> `현황`: 키무라 찬스를 사용한 멤버 전체를 조회합니다.\n\n' +
    '- 키무라 찬스를 이미 사용했다면 `사용` 옵션이, 사용하지 않았다면 `취소` 옵션은 작동하지 않습니다.\n' +
    '- `닉네임`은 `@멘션`이나 등록된 별명을 사용할 수 있습니다.\n' +
    '- `닉네임`을 입력하지 않을 경우 메시지를 보낸 사람으로 설정됩니다.'
  ,
  aliases: ['기무라', '카찬', 'chance', 'kmr'],
  usages: ['<사용|취소|확인|현황> [@멘션=나|별명]'],
  samples: ['사용', '취소 @홍길동', '확인 흥캬삐'],
  privileges: 1110,
  hasArgument: true,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);
    const linked_id = config.linked_id;

    let memberId = null;

    let mode = null;
    let argument = null;
    let errorString = '';

    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      // 기능 처리
      if(/^확인|현황|사용|취소|리셋|초기화$/.test(argument)) {
        mode =
          (argument === '확인') ? KMR_MODE_CHECK :
          (argument === '현황') ? KMR_MODE_STATUS :
          (argument === '사용') ? KMR_MODE_USE :
          (argument === '취소') ? KMR_MODE_CANCEL :
          (argument === '리셋') ? KMR_MODE_RESET : KMR_MODE_RESET;
        continue;
      }

      // 멤버 ID 처리 (@멘션 입력했을 경우)
      let match = null;
      if(memberId == null && (match = argument.match(/^<@!?(\d{18,})>$/)) !== null) {
        memberId = match[1];
        continue;
      }

      // 닉네임으로 추정되는 문자열 처리
      if(memberId == null) {
        // 등록된 별명이 있다면 id 반환
        memberId = Object.keys(linked_id).find(id => linked_id[id].aliases.includes(argument));
        if(memberId != null) continue;
      }

      // 나머지 문자열은 미인식 처리
      errorString += `오류: 인식할 수 없는 문자열입니다. \`${argument}\`\n`;
    }

    if(memberId == null) memberId = message.author.id;

    // 발견된 오류 처리
    if(mode === null)
      errorString += '오류: 옵션이 지정되지 않았습니다. (`확인`, `현황`, `사용`, `취소`)\n';
    if(linked_id[memberId] == null)
      errorString += '오류: 별명이 등록된 멤버가 아닙니다.\n';
    if(errorString.length > 0)
      return message.channel.send(errorString);

    // @TODO 해당 채널에 존재하는 클랜원인지도 확인


    const processTotal = [KMR_MODE_CHECK, KMR_MODE_STATUS].includes(mode) ? 2 : 3;
    const botMessage = await message.channel.send(`초기화 중... (1/${processTotal})`);

    // 시트에 데이터 입력
    const authClient = await getAuthClient();
    let getOptions = {
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      range: sheetConfig.kmr_range
    };

    /* 키무라 전체 리셋 처리 시작 */
    if(mode === KMR_MODE_RESET) {
      return botMessage.edit(
        '경고: 이 옵션은 클랜원 전체의 키무라 상태를 초기화합니다.\n' +
        '실행하려면 `/yes` 를 입력해주세요. (10초 이내)'
      ).then(() => {
        const filter = m => message.author.id === m.author.id;

        message.channel
          .awaitMessages(filter, { time: 10000, max: 1, errors: ['time'] })
          .then(async messages => {
            if(messages.first().content.trim() !== '/yes')
              return message.channel.send('실행이 취소되었습니다.');

            const rangePattern = /^(.+)!([A-Z]+)(\d+):([A-Z]+)(\d+)+$/;
            const resetRange = getOptions.range.replace(rangePattern, '$1!$4$3:$4$5');

            let setOptions = {
              auth: authClient,
              spreadsheetId: sheetConfig.spreadsheet_id,
              valueInputOption: 'USER_ENTERED',
              includeValuesInResponse: true,
              range: resetRange,
              resource: {
                majorDimension: 'COLUMNS', // 입력 방향 다름 (열 우선),
                values: []
              }
            };
            setOptions.resource.values[0] = Array(30).fill(false);
            await sheets.spreadsheets.values.update(setOptions);
            message.channel.send('키무라 상태 초기화 완료');
          }).catch(() => {
            botMessage.edit('입력 시간이 지났으므로 실행을 취소합니다.');
          });
      });
    }
    /* 키무라 전체 리셋 처리 종료 */


    const displayName = verifiedName(memberId, message); // Discord 닉네임
    const sheetName = linked_id[memberId].primary;     // 시트 닉네임
    const kmrIdx = sheetConfig.kmr_idx;

    botMessage.edit(`시트 정보 불러오는 중... (2/${processTotal})`);
    const kmrData = (await sheets.spreadsheets.values.get(getOptions)).data.values;

    const findRowNum = Object.keys(kmrData).findIndex(
      index => sheetName === kmrData[index][kmrIdx.nickname].trim()
    );


    // 작업 처리
    switch(mode) {
    case KMR_MODE_STATUS: {
      let useArray = [];
      kmrData.map(value => {
        if(value[kmrIdx.kmr_state] === 'TRUE') {
          memberId = Object
            .keys(linked_id)
            .find(id => linked_id[id].aliases.includes(value[kmrIdx.nickname]));
          useArray.push(memberId != null ? `<@!${memberId}>` : value[kmrIdx.nickname]);
        }
      });
      if(useArray.length === 0)
        return botMessage.edit('키무라 찬스를 사용한 사람이 없습니다.');

      useArray.sort((a, b) => {
        const aa = message.guild.member(a.slice(3, -1));
        const bb = message.guild.member(b.slice(3, -1));

        if(aa != null) a = aa.displayName;
        if(bb != null) b = bb.displayName;

        return a < b ? -1 : a > b ? 1 : 0;
      });

      return botMessage.edit('', { embed: {
        color: '#0F9D58',
        author: {
          name: `키무라 찬스 사용자 목록 (${useArray.length}명)`,
          icon_url: 'https://www.gstatic.com/images/branding/product/1x/sheets_16dp.png'
        },
        description: useArray.join(', '),
        footer: { text : '시트 기반 데이터' },
        timestamp: Date.now()
      }});
    }
    case KMR_MODE_CHECK: {
      if(findRowNum === -1)
        return botMessage.edit(`오류: 시트에서 \`${sheetName}\`님을 찾을 수 없습니다.`);

      const kmrState = kmrData[findRowNum][kmrIdx.kmr_state] === 'TRUE' ? true : false;

      return botMessage.edit(
        `${getDecoratedName(displayName, sheetName)}님은 키무라 찬스를 ` + (kmrState ? '사용했습니다.' : '사용하지 않았습니다.')
      );
    }
    case KMR_MODE_USE:
    case KMR_MODE_CANCEL: {
      const kmrState = kmrData[findRowNum][kmrIdx.kmr_state] === 'TRUE' ? true : false;

      // 키무라 썼는데 또 사용하려고 하면 오류
      if(mode === KMR_MODE_USE && kmrState === true)
        return botMessage.edit(`오류: ${getDecoratedName(displayName, sheetName)}님은 키무라 찬스를 이미 사용했습니다.`);

      // 키무라 안썼는데 해제하려고 하면 오류
      if(mode === KMR_MODE_CANCEL && kmrState === false)
        return botMessage.edit(`오류: ${getDecoratedName(displayName, sheetName)}님은 키무라 찬스를 사용하지 않았습니다.`);

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
      setOptions.resource.values[0] = Array(kmrIdx.kmr_state+1).fill(null);
      setOptions.resource.values[0][kmrIdx.kmr_state] = !kmrState;

      botMessage.edit(`키무라 상태 적용 중... (3/${processTotal})`);
      const responseData = (await sheets.spreadsheets.values.update(setOptions)).data.updatedData.values;

      return botMessage.edit(
        `${getDecoratedName(displayName, sheetName)}님의 키무라 상태 변경 완료: ` +
        `**\`${responseData[0][kmrIdx.kmr_state]}\`**`);
    } /* end of case */
    } /* end of switch */
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
