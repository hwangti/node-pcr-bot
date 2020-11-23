const { getAuthClient, sheets } = require(`${global.dirname}/modules/spreadsheets.js`);

module.exports = {
  name: '남은횟수',
  category: 'clanbattle',
  summary: '남은 타격 횟수를 확인합니다.',
  description: '시트에 입력된 전투 기록 기반으로 클랜원의 남은 타격 횟수를 확인할 수 있습니다.',
  aliases: ['remain'],
  cooltime: 5,
  privileges: 1110,

  async execute(message) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);
    const linked_id = config.linked_id;

    if(!sheetConfig.spreadsheet_id)
      return message.channel.send('조수 군! 먼저 클랜 시트를 설정해주게나.');

    // 클랜 배틀 몇 일차인지 확인
    const dateObject = new Date();
    if(dateObject.getHours() < 5) dateObject.setDate(dateObject.getDate() - 1);
    let dateOffset = dateObject.getDate() - new Date(config.clanbattle_start_time).getDate() + 1;
    if(dateOffset <= 0) dateOffset = 1;
    if(dateOffset > config.clanbattle_duration_day) dateOffset = config.clanbattle_duration_day;

    const botMessage = await message.channel.send('초기화 중이라네... (1/2)');
    const authClient = await getAuthClient();
    let getOptions = {
      auth: authClient,
      spreadsheetId: sheetConfig.spreadsheet_id,
      range: sheetConfig.remain_range
    };
    // 날짜별로 분할된 시트라면 현재 날짜에 맞게 시트 범위 수정 (1)
    if(sheetConfig.split_date === true)
      getOptions.range = getOptions.range.replace('{offset}', dateOffset);

    await botMessage.edit('시트 정보를 불러오는 중이라네... (2/2)');
    const remainIdx = sheetConfig.remain_idx;
    const remainData = (await sheets.spreadsheets.values.get(getOptions)).data.values;

    // 한 행에 여러명의 데이터가 들어간 경우 처리 (MAHO)
    const length = remainData[0].length;
    const count = Math.ceil(length / (remainIdx.remain_time + 1)); // 루프 갯수
    const fixLength = Math.ceil(length / count);

    let remainArray = [];
    remainData.map(value => {
      for(let i=0; i<length; i+=fixLength)
        remainArray.push([
          value[i+remainIdx.nickname]  != null ? value[i+remainIdx.nickname]  : '',
          value[i+remainIdx.attack]    != null ? value[i+remainIdx.attack]    : '',
          value[i+remainIdx.kill_boss]   != null ? value[i+remainIdx.kill_boss]   : '',
          value[i+remainIdx.remain_time] != null ? value[i+remainIdx.remain_time] : ''
        ]);
    });

    let remainString = '';
    let mainCount = 0;
    let bonusCount = 0;
    remainArray.sort().map(value => {
      let sCount = 3 - (isNaN(parseInt(value[1])) ? 0 : parseInt(value[1]));
      if(value[3] !== '' && config.sheet_type === 'MAHO') --sCount; // 남은횟수에 이월 제외함
      if(value[3] !== '' && config.sheet_type === 'SUYA') --sCount;
      if(value[3] !== '' && config.sheet_type === 'RIMA') --sCount;

      if(sCount !== 0 || value[3] !== '') {
        value[2] = value[2].replace(/TRUE|FALSE/, '');

        const memberId = Object
          .keys(linked_id)
          .find(id => linked_id[id].aliases.includes(value[0]));
        remainString += `- ${(memberId != null ? `<@!${memberId}>:` : `**${value[0]}:**`)}`;
        if(sCount !== 0) {
          remainString += ` ${sCount}회`;
          if(value[3] !== '') remainString += ' +';
          mainCount += sCount;
        }
        if(value[3] !== '') {
          remainString += ' 이월 (';
          remainString += (value[2] !== '') ? `${value[2]}, ` : '';
          remainString += value[3] + ')';
          bonusCount += 1;
        }
        remainString += '\n';
      }
    });

    if(mainCount + bonusCount === 0)
      return botMessage.edit('모든 멤버가 타격을 완료했다네, 조수 군!');

    remainString =
      `** 🔹 남은 횟수: ${mainCount+bonusCount}** (` +
      (mainCount > 0 ? `일반: ${mainCount}` : '') +
      (bonusCount > 0 ? ` 이월: ${bonusCount}` : '') +
      ')\n=========================\n' + remainString;


    // 메시지 꾸미기
    return botMessage.edit('', { embed: {
      color: '#0F9D58',
      author: {
        name: '남은 횟수',
        icon_url: 'https://www.gstatic.com/images/branding/product/1x/sheets_16dp.png'
      },
      footer: {
        text: '시트 기반 데이터'
      },
      timestamp: Date.now(),
      description: remainString
    }});
  }
};
