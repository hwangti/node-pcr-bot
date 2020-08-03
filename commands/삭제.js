const { getAuthClient, sheets } = require('../modules/spreadsheets.js');

module.exports = {
  name: '삭제',
  summary: '클랜 시트에 입력된 마지막 전투 기록을 삭제합니다.',
  aliases: ['delete'],
  cooltime: 4,
  privileges: 1110,

  async execute(message) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);

    // 클랜 배틀 몇 일차인지 확인
    const dateObject = new Date();
    if(dateObject.getHours() < 5) dateObject.setDate(dateObject.getDate() - 1);
    let dateOffset = dateObject.getDate() - new Date(config.clanbattle_start_time).getDate() + 1;
    if(dateOffset <= 0) dateOffset = 1;
    if(dateOffset > config.clanbattle_duration_day) dateOffset = config.clanbattle_duration_day;

    const botMessage = await message.channel.send('초기화 중... (1/3)');
    const authClient = await getAuthClient();
    let getOptions = {
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      range: sheetConfig.log_range
    };
    // 날짜별로 분할된 시트라면 현재 날짜에 맞게 시트 범위 수정 (1)
    if(sheetConfig.split_date === true)
      getOptions.range = getOptions.range.replace('{offset}', dateOffset);

    const fullIdx = sheetConfig.log_full_idx;
    const insertIdx = sheetConfig.log_insert_idx;
    const deletedIdx = sheetConfig.log_deleted_idx;

    await botMessage.edit('시트 정보 불러오는 중... (2/3)');
    const logData = (await sheets.spreadsheets.values.get(getOptions)).data.values;

    // 정규식으로 시작 행 추출 (기록!B6:AA905 -> 6)
    const rangePattern = /^(.+)!([A-Z]+)(\d+):([A-Z]+)(\d+)+$/;
    const startRowNum = parseInt(getOptions.range.replace(rangePattern, '$3'));
    const lastRowNum = startRowNum +
      (logData != null ? logData.findIndex(row => row[insertIdx.nickname].length === 0) : 0);

    if(startRowNum === lastRowNum)
      return botMessage.edit('오류: 삭제할 데이터가 없습니다.');


    // 삭제할 범위를 단일 행으로 변환
    let deleteRange = deletedIdx.delete_range
      .map(value => value.replace(/{offset}/g, dateOffset))
      .map(value => value.replace(/{row}/g, lastRowNum-1));
    let trueRange = null;
    let falseRange = null;
    if(deletedIdx.check_true_range !== null)
      trueRange = deletedIdx.check_true_range
        .map(value => value.replace(/{offset}/g, dateOffset))
        .map(value => value.replace(/{row}/g, lastRowNum-1));
    if(deletedIdx.check_false_range !== null)
      falseRange = deletedIdx.check_false_range
        .map(value => value.replace(/{offset}/g, dateOffset))
        .map(value => value.replace(/{row}/g, lastRowNum-1));


    let clearOptions = { // batchClear() Method
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      ranges: [ deleteRange ]
    };
    let resetOptions = { // batchUpdate() Method
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      valueInputOption: 'USER_ENTERED',
      resource: { data: [] }
    };
    // 셀 초기화가 필요한 부분 설정
    if(trueRange !== null)
      trueRange.map(value => {
        resetOptions.resource.data.push({ range: value, values: [[ true ]] });
      });
    if(falseRange !== null)
      falseRange.map(value => {
        resetOptions.resource.data.push({ range: value, values: [[ false ]] });
      });

    // 시트 값 삭제 및 초기화
    await botMessage.edit('전투 기록 삭제 중... (3/3)');
    await sheets.spreadsheets.values.batchClear(clearOptions);
    if(resetOptions.resource.data.length > 0)
      await sheets.spreadsheets.values.batchUpdate(resetOptions);


    // 메시지 꾸미기
    const embed = {
      color: '#0F9D58',
      author: {
        name: '삭제 정보',
        icon_url: 'https://www.gstatic.com/images/branding/product/1x/sheets_16dp.png'
      },
      timestamp: Date.now(),
      fields: []
    };

    if(fullIdx.number != null)
      embed.footer = {
        text: `로그 번호 ${logData[lastRowNum-startRowNum-1][fullIdx.number]}`,
        icon_url: 'https://discordapp.com/assets/6debd47ed13483642cf09e832ed0bc1b.png'
      };

    embed.fields.push({
      name: '보스',
      value:
        `${logData[lastRowNum-startRowNum-1][fullIdx.round].replace('회차', '')}회차 ` +
        `${logData[lastRowNum-startRowNum-1][fullIdx.boss].replace(/^\d-/, '')}`,
      inline: true
    });
    embed.fields.push({
      name: '닉네임',
      value: logData[lastRowNum-startRowNum-1][fullIdx.nickname],
      inline: true
    });
    embed.fields.push({
      name: '딜량',
      value: global.fn.numberFormat(logData[lastRowNum-startRowNum-1][fullIdx.deal_sum]),
      inline: true
    });

    return botMessage.edit('', { embed: embed });
  }
};
