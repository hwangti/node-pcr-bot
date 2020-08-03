const { getAuthClient, sheets } = require('../modules/spreadsheets.js');

module.exports = {
  name: '입력',
  summary: '클랜 시트에 전투 기록을 입력합니다.',
  description:
    '> `캐릭터`는 정식 명칭이나 줄임말(예: `수페코`, `치카(성탄)`)으로 입력 가능합니다.\n' +
    '> `딜량`은 8자리 숫자(99,999,999)까지 입력 가능합니다.\n\n' +
    '아래와 같은 방식 모두 입력 가능하지만, 방식을 혼용해서 입력할 수는 없습니다.\n' +
    '- 캐릭터 딜량 캐릭터 딜량 순 >> OK\n' +
    '- 캐릭터 캐릭터 딜량 딜량 순 >> OK\n' +
    '- 카오리12345 마코토55555 (캐릭터딜량 순) >> OK\n\n' +
    '- `닉네임`은 `@멘션`이나 등록된 별명을 사용할 수 있습니다.\n' +
    '- `닉네임`을 입력하지 않을 경우 메시지를 보낸 사람으로 설정됩니다.\n\n' +
    '아래와 같은 방식은 시트가 지원하는 경우 사용 가능합니다.\n' +
    '> 캐릭터 개별의 딜량이 포함된 상세입력 또는 합계딜량만 입력\n' +
    '> `표본` 포함 기능 (`0`, `1`, 기본값: `1`)\n' +
    '> 캐릭터와 딜량 5개 뒤에 입력되는 값은 `메모`로 인식됩니다.\n'
  ,
  usages: [
    '<@멘션=나|별명> <합계딜량> [/0|1] [메모]', // 2~4 params
    '<@멘션=나|별명> <캐릭터...> <딜량...> [/0|1] [메모]' // 11~13 params
  ],
  samples: [
    '홍길동 123456',
    '홍길동 카오리 시오리 마코토 사렌 쥰 456405 333696 307864 119968 35957 1 국민조합'
  ],
  cooltime: 5,
  privileges: 1110,
  hasArgument: true,
  checkStrict: true,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);
    const units = message.client.config.get(`${message.guild.id}_units`);
    const linked_id = config.linked_id;

    // 클랜 배틀 몇 일차인지 확인
    const dateObject = new Date();
    if(dateObject.getHours() < 5) dateObject.setDate(dateObject.getDate() - 1);
    let dateOffset = dateObject.getDate() - new Date(config.clanbattle_start_time).getDate() + 1;
    if(dateOffset <= 0) dateOffset = 1;
    if(dateOffset > config.clanbattle_duration_day) dateOffset = config.clanbattle_duration_day;

    let memberId = null;

    let chars = [];
    let dealSum = null;
    let isSample = true; // 표본
    let memo = ''; // 메모

    let argument = null;
    let charLength = 0;
    let dealLength = 0;
    let errorString = '';
    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
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

      // 캐릭터딜량으로 추정되는 문자열 처리 (예: 카오리456405)
      if(charLength < 5 && dealLength < 5 && (match = argument.match(/^([()가-힣]+)(\d{1,7})$/)) !== null) {
        let unitId = Object.keys(units).find(id => units[id].unit_alias.includes(match[1]));
        let damage = parseInt(match[2]);

        if(unitId == null || isNaN(damage) === true) {
          errorString += `오류: 딜량 정보를 인식할 수 없습니다. \`${argument}\`\n`;
          break;
        }

        if(charLength !== dealLength) {
          errorString += '오류: 딜량 정보를 혼용해서 입력할 수 없습니다.\n';
          break;
        }
        dealSum += damage;
        chars[charLength] = units[unitId];
        chars[dealLength].damage = damage;
        ++charLength;
        ++dealLength;
        continue;
      }

      // 딜량캐릭터으로 추정되는 문자열 처리 (예: 456405카오리)
      if(charLength < 5 && dealLength < 5 && (match = argument.match(/^(\d{1,7})([()가-힣]+)$/)) !== null) {
        let unitId = Object.keys(units).find(id => units[id].unit_alias.includes(match[2]));
        let damage = parseInt(match[1]);

        if(unitId == null || isNaN(damage) === true) {
          errorString += `오류: 딜량 정보를 인식할 수 없습니다. \`${argument}\`\n`;
          break;
        }

        if(charLength !== dealLength) {
          errorString += '오류: 딜량 정보를 혼용해서 입력할 수 없습니다.\n';
          break;
        }
        dealSum += damage;
        chars[charLength] = units[unitId];
        chars[dealLength].damage = damage;
        ++charLength;
        ++dealLength;
        continue;
      }

      // 캐릭터로 추정되는 문자열 처리
      if(charLength < 5 && /^[()가-힣]+$/.test(argument)) {
        let unitId = Object.keys(units).find(id => units[id].unit_alias.includes(argument));

        if(unitId == null) {
          errorString += `오류: 캐릭터 정보를 찾을 수 없습니다. \`${argument}\`\n`;
          break;
        }

        if(chars[charLength] == null) chars[charLength] = {};
        chars[charLength] = Object.assign(chars[charLength], units[unitId]);
        ++charLength;
        continue;
      }

      // 대미지로 추정되는 문자열 처리
      if(dealLength < 5 && /^\d{1,8}$/.test(argument)) {
        const damage = parseInt(argument);

        if(chars[dealLength] == null) chars[dealLength] = {};
        chars[dealLength++].damage = damage;
        dealSum += damage;
        continue;
      }

      // 표본으로 추정되는 문자열 처리
      if(/^\/[01]$/.test(argument)) {
        isSample = !!parseInt(argument[1]);
        continue;
      }

      // 인식할 수 없는 문자열은 메모로 가정
      memo = (memo + ' ' + argument).trim();
    }

    if(dealLength === 0)
      errorString += '오류: 딜량 정보가 입력되지 않았습니다.\n';
    if(charLength > 0 && charLength !== dealLength)
      errorString += '오류: 딜량 정보가 모두 입력되지 않았습니다.\n';
    if(charLength > 1 && sheetConfig.has_detail === false)
      errorString += '오류: 상세 입력은 지원하지 않습니다.\n';

    if(errorString.length > 0)
      return message.channel.send(errorString);

    if(memberId == null) memberId = message.author.id;

    // 시트에 삽입하기 전에 정렬이 필요하다면 정렬
    if(sheetConfig.has_sort === true) {
      chars.sort((a, b) => {
        if(a.search_area_width < b.search_area_width) return -1;
        if(a.search_area_width > b.search_area_width) return 1;

        return a.unit_id < b.unit_id ? -1 : a.unit_id > b.unit_id ? 1 : 0;
      });
    }

    // 덜 입력된 데이터 완성
    if(chars[1] == null) chars[1] = { damage: null, sheet_name: null };
    if(chars[2] == null) chars[2] = { damage: null, sheet_name: null };
    if(chars[3] == null) chars[3] = { damage: null, sheet_name: null };
    if(chars[4] == null) chars[4] = { damage: null, sheet_name: null };

    // 단순 입력했다면 캐릭터 1에 몰빵
    if(charLength === 0 && dealLength === 1)
      chars[0].sheetName = null;

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

    const fullIdx = sheetConfig.log_full_idx;
    const insertIdx = sheetConfig.log_insert_idx;

    botMessage.edit('시트 정보 불러오는 중... (2/3)');
    const logData = (await sheets.spreadsheets.values.get(getOptions)).data.values;


    // 정규식으로 시작 행 추출 (기록!B6:AA905 -> 6)
    const rangePattern = /^(.+)!([A-Z]+)(\d+):([A-Z]+)(\d+)+$/;
    const startRowNum = parseInt(getOptions.range.replace(rangePattern, '$3'));
    const lastRowNum = startRowNum +
      (logData != null ? logData.findIndex(row => row[insertIdx.nickname].length === 0) : 0);
    // 206 라인 오류 (Cannot read property 'length' of undefined) => sheet.json의 log_range 범위 확인 바람

    const insertRange = getOptions.range.replace(rangePattern, `$1!$2${lastRowNum}:$4${lastRowNum}`);
    const insertValues = [[]];

    if(insertIdx.date    != null) insertValues[0][insertIdx.date]    = global.dateFormat(dateObject, 'yyyy-MM-dd');
    if(insertIdx.nickname  != null) insertValues[0][insertIdx.nickname]  = linked_id[memberId].primary;
    if(insertIdx.char_1  != null) insertValues[0][insertIdx.char_1]  = chars[0].sheet_name;
    if(insertIdx.char_2  != null) insertValues[0][insertIdx.char_2]  = chars[1].sheet_name;
    if(insertIdx.char_3  != null) insertValues[0][insertIdx.char_3]  = chars[2].sheet_name;
    if(insertIdx.char_4  != null) insertValues[0][insertIdx.char_4]  = chars[3].sheet_name;
    if(insertIdx.char_5  != null) insertValues[0][insertIdx.char_5]  = chars[4].sheet_name;
    if(insertIdx.deal_1  != null) insertValues[0][insertIdx.deal_1]  = chars[0].damage;
    if(insertIdx.deal_2  != null) insertValues[0][insertIdx.deal_2]  = chars[1].damage;
    if(insertIdx.deal_3  != null) insertValues[0][insertIdx.deal_3]  = chars[2].damage;
    if(insertIdx.deal_4  != null) insertValues[0][insertIdx.deal_4]  = chars[3].damage;
    if(insertIdx.deal_5  != null) insertValues[0][insertIdx.deal_5]  = chars[4].damage;
    if(insertIdx.deal_sum  != null) insertValues[0][insertIdx.deal_sum]  = dealSum;
    if(insertIdx.is_kill   != null) insertValues[0][insertIdx.is_kill]   = undefined;
    if(insertIdx.is_bonus  != null) insertValues[0][insertIdx.is_bonus]  = undefined;
    if(insertIdx.is_sample != null) insertValues[0][insertIdx.is_sample] = isSample;
    if(insertIdx.memo    != null) insertValues[0][insertIdx.memo]    = memo;

    // 격파 체크 처리 (RIMA)
    if(sheetConfig.boss_hp_type == 'BEFORE' && insertIdx.is_kill != null) {
      // await botMessage.edit('보스 격파 확인 중... (2/3)');
      insertValues[0][insertIdx.is_kill] = false;

      // 보스의 남은 HP가 가한 대미지 이하라면 격파 처리
      if(lastRowNum - startRowNum === 0 && dealSum >= 6000000)
        insertValues[0][insertIdx.is_kill] = true;
      else if(dealSum >= parseInt(logData[lastRowNum-startRowNum][fullIdx.remain_hp].replace(/,/g, '')))
        insertValues[0][insertIdx.is_kill] = true;
    }

    // 이월 체크 처리 (RIMA)
    if(insertIdx.is_bonus != null) {
      // await botMessage.edit('이월 파티 확인 중... (2/3)');

      // 같은 조합이 있는지 찾고 있다면 이월 처리
      const samePartyIdx = logData.findIndex(row => {
        if(
          global.dateFormat(dateObject, 'M. d') === row[insertIdx.date] &&
          linked_id[memberId].primary === row[insertIdx.nickname] &&
          chars[0].sheet_name === row[insertIdx.char_1] &&
          chars[1].sheet_name === row[insertIdx.char_2] &&
          chars[2].sheet_name === row[insertIdx.char_3] &&
          chars[3].sheet_name === row[insertIdx.char_4] &&
          chars[4].sheet_name === row[insertIdx.char_5]
        )
          return true;
      });

      if(samePartyIdx > -1)
        insertValues[0][insertIdx.is_bonus] = true;
    }


    botMessage.edit('기록 입력 중... (3/3)');
    let setOptions = {
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      valueInputOption: 'USER_ENTERED',
      includeValuesInResponse: true,
      responseValueRenderOption: 'FORMATTED_VALUE',
      range: insertRange,
      resource: { values: insertValues }
    };
    const updatedData = (await sheets.spreadsheets.values.update(setOptions)).data.updatedData.values;

    // 표본 제외 처리 (MOMO)
    if(fullIdx.battle_type != null && fullIdx.is_sample != null) {
      const isSample = !(
        updatedData[0][fullIdx.battle_type].length > 0 &&
        /^이월/.test(updatedData[0][fullIdx.battle_type]) &&
        !/^1:30$/.test(updatedData[0][fullIdx.battle_type])
      );
      if(isSample === false) {
        botMessage.edit('추가 작업 중... (표본 제외) (4/4)');
        setOptions.resource.values[0].fill(null);
        setOptions.resource.values[0][fullIdx.is_sample] = false;
        await sheets.spreadsheets.values.update(setOptions);
      }
    }


    // 메시지 꾸미기
    const embed = {
      color: '#0F9D58',
      author: {
        name: '입력 정보',
        icon_url: 'https://www.gstatic.com/images/branding/product/1x/sheets_16dp.png'
      },
      timestamp: Date.now(),
      fields: []
    };

    if(fullIdx.number != null)
      embed.footer = {
        text: `로그 번호 ${updatedData[0][fullIdx.number]}`,
        icon_url: 'https://discordapp.com/assets/6debd47ed13483642cf09e832ed0bc1b.png'
      };

    embed.fields.push({
      name: '보스',
      value:
        `${updatedData[0][fullIdx.round].replace('회차', '')}회차 ` +
        `${updatedData[0][fullIdx.boss].replace(/^\d-/, '')}`,
      inline: true
    });
    embed.fields.push({
      name: '닉네임',
      value: updatedData[0][fullIdx.nickname],
      inline: true
    });

    if(sheetConfig.has_detail === true) {
      const charString = `${updatedData[0][fullIdx.char_1]} ` +
        `${updatedData[0][fullIdx.char_2]} ` + `${updatedData[0][fullIdx.char_3]} ` +
        `${updatedData[0][fullIdx.char_4]} ` + `${updatedData[0][fullIdx.char_5]}`;

      if(charString.trim().length > 10)
        embed.fields.push({ name: '사용 캐릭터', value: charString });
    }

    // eslint-disable-next-line no-irregular-whitespace
    let damageString = `합　계: ${global.fn.numberFormat(updatedData[0][fullIdx.deal_sum])}`;
    if(
      updatedData[0][fullIdx.deal_sum].length > 0 &&
      updatedData[0][fullIdx.deal_real].length > 0 &&
      updatedData[0][fullIdx.deal_sum] !== updatedData[0][fullIdx.deal_real]
    )
      damageString += ` (반영: ${global.fn.numberFormat(updatedData[0][fullIdx.deal_real])})`;
    if(fullIdx.deal_score != null)
      damageString += `\n스코어: ${global.fn.numberFormat(updatedData[0][fullIdx.deal_score])}`;
    embed.fields.push({ name: '딜량', value: damageString });

    embed.fields.push({
      name: '잔여 보스 HP',
      value: global.fn.numberFormat(
        Math.max(0,
          parseInt(updatedData[0][fullIdx.remain_hp].replace(/,/g, '')) -
          (sheetConfig.boss_hp_type == 'BEFORE' ? dealSum : 0)
        )
      ),
      inline: true
    });

    // 기타 데이터
    let otherString = '';
    if(fullIdx.battle_type != null && updatedData[0][fullIdx.battle_type].length > 0)
      otherString += updatedData[0][fullIdx.battle_type];
    if(fullIdx.is_sample != null && (updatedData[0][fullIdx.is_sample] === 'FALSE' || isSample === false))
      otherString += '\n(표본 제외)';

    if(otherString !== '')
      embed.fields.push({ name: '구분', value: otherString, inline: true });

    if(fullIdx.is_kill != null && updatedData[0][fullIdx.is_kill] != null && updatedData[0][fullIdx.is_kill].length > 0)
      embed.fields.push({
        name: '이월 시간',
        value: `${updatedData[0][fullIdx.is_kill]}초`.replace('초초', '초')
      });

    if(fullIdx.memo != null && updatedData[0][fullIdx.memo].length > 0)
      embed.fields.push({ name: '메모', value: updatedData[0][fullIdx.memo] });

    return botMessage.edit('', { embed: embed });
  }
};
