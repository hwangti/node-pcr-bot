const fetch = require('node-fetch');
const units = require(`${global.dirname}/config/_units.json`);

/* eslint-disable no-irregular-whitespace */
const STAT_MODE_CALC = 'calc';
const STAT_MODE_DIFF = 'diff';

module.exports = {
  name: '스탯',
  category: 'priconne',
  summary: '캐릭터의 스테이터스를 확인 또는 비교합니다.',
  description:
    // '- `구분`: 계산 유형을 선택합니다. (`계산`, `비교`)\n' +
    // '기본 값은 `계산` 입니다.\n' +
    // '동일 캐릭터나 다른 캐릭터도 비교 가능하며, 입력된 순서대로 정보가 지정됩니다.\n' +
    // '1개 또는 3개 이상이 입력된 경우 각 캐릭터의 스탯 정보만 표시됩니다.\n' +
    // '캐릭터 2개의 스탯을 비교하고 싶은 경우 `비교`를 입력하면 결과에 캐릭터 스탯 차이가 표시됩니다.\n' +
    '- `서버`: 서버를 선택합니다. (`한국`, `일본`, `중국`, `대만` 등)\n' +
    '디스코드 서버에 따라 자동으로 지정되며, 다른 서버의 정보를 확인하고 싶을 때 별도로 입력하면 됩니다.\n\n' +

    '- `캐릭터`: 캐릭터 이름을 입력합니다. (별명 입력 가능, 예: `수캬루`)\n' +
    '- `성급`: 캐릭터 성급을 입력합니다. (`3성`, `★5` 등)\n' +
    '기본 값은 각 캐릭터 초기 개화상태입니다. (히요리의 경우 1성)\n' +
    '- `레벨`: 캐릭터 레벨을 입력합니다. (`127렙`, `130레벨` 등)\n' +
    '- `전장레벨`: 캐릭터 전용장비 레벨을 입력합니다. (`전30`, `전장130` 등 앞에 `전` 입력)\n' +
    '출시되지 않은 전용장비는 무시됩니다. 포함된 스탯을 확인하려면 `일본`을 입력하세요.\n\n' +

    '- `랭크`: 캐릭터 랭크를 지정합니다. (`12랭`, `13.4` 등)\n' +
    '랭크를 소수점으로 입력할 경우 왼쪽 위부터 아래로 6,5,4, 오른쪽 위부터 아래로 3,2,1 입니다.\n' +
    '(예: `13.4` 이면 왼쪽 상단 2개 제외한 나머지 아이템)\n' +
    '이 경우, 장비 강화 MAX 상태로 계산됩니다. 강화 상태를 조절하려면 `장비상태`로 지정해야 합니다.\n' +
    '- `장비상태`: 장비 착용 상태를 수동으로 지정할 수 있습니다.\n' +
    '순서는 왼쪽부터 오른쪽으로 위에서 아래 입니다.\n' +
    '(게임 내 캐릭터 이미지 > 랭크 상세를 눌러서 나오는 순서와 동일)\n' +
    '`0`은 착용하지 않은 상태, `1`은 착용만 한 상태, `2`는 착용+강화MAX 상태입니다.\n' +
    '(예: `220222` 이면 왼쪽 중간 아이템 제외하고 나머지 모두 착용 및 풀강 상태)\n\n' +

    '- `인연랭크`: 캐릭터의 인연 랭크를 지정합니다. (`인8,8`, `인연0,0,0` 등)\n' +
    '각각의 랭크는 공백 없이 `인`, `인연`을 먼저 입력한 뒤 쉼표와 숫자로 연속으로 적습니다.\n' +
    '인연 랭크 순서는 스탯을 확인할 캐릭터가 가장 먼저, 이후 출시된 순서로 입력합니다.\n' +
    '(예: 콧코로 => 콧코로-수코로-뉴코로-프코로 순서이므로 `인12,0,0,8`)\n' +
    '(예: 수캬루 => 수캬루-캬루-냐루 순서이므로 (스탯 확인 캐릭터 우선) `인8,12,8`)\n' +
    '인연 랭크를 입력하지 않을 경우 최대 인연 랭크로 설정됩니다.\n' +
    '보유하지 않은 캐릭터라면 해당 자리에 `0`을 입력하면 됩니다.\n'
  ,
  aliases: ['스테이터스', 'stat'],
  usages: ['[서버] 캐릭터 [성급] [레벨] [랭크] [장비상태] [전장레벨] [인연랭크]'],
  // usages: ['[구분] [서버] 캐릭터 [성급] [레벨] [랭크] [장비상태] [전장레벨]'],
  samples: ['카스미 3성 11랭', '뉴이 11랭 12랭 13랭', '쿄우카 5성 12랭 220222 전130', '비교 쿄우카 12.6 13.4 인8,0'],
  privileges: 1111,
  checkStrict: false,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);

    let server = ['MAHO', 'NONE'].includes(config.sheet_type) ? 'jp' : 'kr';
    let chars = [];
    const charObject = { id: null, rarity: null, level: null, spec: null, rank: null, unique: null, equip: null, love: null };

    let mode = STAT_MODE_CALC;
    let argument = null;
    let errorString = '';

    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      let match = null;

      // 작업 유형 확인
      if(['비교'].includes(argument)) { mode = STAT_MODE_DIFF; continue; }
      // if(['계산'].includes(argument)) { mode = STAT_MODE_CALC; continue; }

      // 서버 확인
      if(server != null && ['한국', 'kr'].includes(argument.toLowerCase())) { server = 'kr'; continue; }
      if(server != null && ['일본', 'jp'].includes(argument.toLowerCase())) { server = 'jp'; continue; }
      if(server != null && ['중국', 'cn'].includes(argument.toLowerCase())) { server = 'cn'; continue; }
      if(server != null && ['대만', 'tw'].includes(argument.toLowerCase())) { server = 'tw'; continue; }

      // 캐릭터로 추정되는 문자열 처리
      if(/^[()가-힣]+$/.test(argument)) {
        let unitId = Object.keys(units).find(id => units[id].unit_alias.includes(argument));

        if(unitId == null) {
          errorString += `조수 군! 캐릭터 정보를 찾을 수 없다네. \`${argument}\`\n`;
          break;
        }

        let i = 0;
        while(chars[i] && chars[i].id) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].id = unitId + '01';
        continue;
      }

      // 성급으로 추정되는 문자열 처리
      if(/^★?[1-6]$/.test(argument) || /^[1-6]성?$/.test(argument)) {
        let i = 0;
        while(chars[i] && chars[i].rarity) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].rarity = parseInt(argument.replace(/[★성]/g, ''));
        continue;
      }

      // 레벨로 추정되는 문자열 처리
      if(/^[0-9]{3}(렙|레벨)?$/.test(argument)) {
        let i = 0;
        while(chars[i] && chars[i].level) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].level = parseInt(argument.replace(/[레렙벨]/g, ''));
        continue;
      }

      // 랭크+장비 혼합정보로 추정되는 문자열 처리 (12.6  13.4 등)
      if((match = argument.match(/^(\d{1,2}\.\d{1})$/)) !== null) {
        let i = 0, spec = match[0];
        while(chars[i] && chars[i].spec) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].spec = parseFloat(spec);
        continue;
      }

      // 랭크로 추정되는 문자열 처리
      if(/^[0-9]{2}(랭|랭크)?$/.test(argument)) {
        let i = 0;
        while(chars[i] && chars[i].rank) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].rank = parseInt(argument.replace(/[랭크]/g, ''));
        continue;
      }

      // 전용장비 레벨로 추정되는 문자열 처리
      if(/^전장?\d{1,3}$/.test(argument)) {
        let i = 0;
        while(chars[i] && chars[i].unique) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].unique = parseInt(argument.replace(/[전장]/g, ''));
        continue;
      }

      // 장비 착용 상태로 추정되는 문자열 처리
      if(/^[012]{6}$/.test(argument)) {
        let i = 0;
        while(chars[i] && chars[i].equip) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].equip = argument.split('');
        continue;
      }

      // 인연 랭크 상태로 추정되는 문자열 처리
      if(/^인연?[0-9,]{1,9}$/.test(argument)) {
        let i = 0;
        while(chars[i] && chars[i].love) ++i;

        if(chars[i] == null)
          chars[i] = Object.assign({}, charObject);
        chars[i].love = argument.replace(/[인연]/g, '').split(',');
        continue;
      }

      // 나머지 문자열은 미인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }

    // 발견된 오류 처리
    if(mode === STAT_MODE_DIFF && chars.length != 2)
      errorString += '조수 군! 스테이터스를 비교하려면 캐릭터 정보를 2개 입력해야한다네.\n';
    if(errorString.length > 0)
      return message.channel.send(errorString);

    // 비어있는 데이터를 1번째 값으로 할당
    for(let i=chars.length-1; i>0; i--) {
      Object.keys(chars[i]).map(key => {
        // console.log('i =>', i, ', key =>', key, ', data => ', chars[i][key], chars[0][key]);
        if(chars[i][key] == null && chars[0][key] != null)
          chars[i][key] = chars[0][key];
      });
    }

    const data = JSON.stringify(chars);
    console.log('/calc.php?server=' + server + '&mode=' + mode + '&data=' + data);

    const botMessage = await message.channel.send('요청 중...');
    let response = null;
    let hasError = false;

    await fetch('https://pcr-momo.club/calc.php?server=' + server + '&mode=' + mode + '&data=' + data)
      .then(res => res.json())
      .then(json => response = json)
      .catch(err => {
        hasError = true;
        console.error(err);
        return botMessage.edit(`조수 군, 명령어를 실행하는 중에 오류가 발생한 것 같다네...\n\`\`\`${err.type}\`\`\``);
      });

    if(hasError) return;
    if(response.error)
      return botMessage.edit(`조수 군! 입력 데이터가 올바르지 않다네.\n\`\`\`${response.error}\`\`\``);

    const embed = {
      title: '스테이터스 계산',
      timestamp: Date.now(),
      footer: { text: server.toUpperCase() + ' 서버 데이터' },
      fields: []
    };

    response.units.map((value, key) => {
      let diffString = '';
      diffString += `**\`캐릭터\`** ${value.profile.name} (★${value.spec.rarity})\n`;
      diffString += `**\`위치값\`** ${value.profile.search_area_width}\n\n`;

      diffString += `**\`레　벨\`** ${value.spec.level}\n`;
      diffString += `**\`랭　크\`** ${value.spec.rank}\n`;
      diffString += `**\`장비상태\`** ${value.spec.equip.map(val => val.equip_state).join(' | ')}\n`;
      if(value.spec.unique > 0)
        diffString += `**\`전용장비\`** ${value.spec.unique}\n`;
      diffString += '\n';

      diffString += `**\`전투력\`** ${global.fn.numberFormat(value.stat.power)}\n`;
      diffString += `**\`　　HP\`** ${global.fn.numberFormat(value.stat.hp)}\n`;
      diffString += `**\`공격력\`** ${global.fn.numberFormat(value.stat.atk)} / ${global.fn.numberFormat(value.stat.magic_str)}\n`;
      diffString += `**\`방어력\`** ${value.stat.def} / ${value.stat.magic_def}\n`;
      diffString += `**\`크리티컬\`** ${value.stat.physical_critical} / ${value.stat.magic_critical}\n`;
      diffString += `**\`자동회복\`** ${value.stat.wave_hp_recovery} / ${value.stat.wave_energy_recovery}\n`;
      diffString += `**\`회피\`** ${value.stat.dodge}\n`;
      diffString += `**\`HP 흡수\`** ${value.stat.life_steal}\n`;
      diffString += `**\`회복량 상승\`** ${value.stat.hp_recovery_rate}\n`;
      diffString += `**\`TP 상승\`** ${value.stat.energy_recovery_rate}\n`;
      diffString += `**\`TP 소비감소\`** ${value.stat.energy_reduce_rate}\n`;
      diffString += `**\`명중\`** ${value.stat.accuracy}\n`;

      let starImage = String(value.profile.id).substr(0, 4);
      starImage +=  ([1,2].includes(value.spec.rarity) ? 1 : ([3,4,5].includes(value.spec.rarity) ? 3 : 6)) + '1';

      embed.thumbnail = { url: `https://redive.estertion.win/icon/unit/${starImage}.webp` };
      embed.fields.push({
        name: '캐릭터 ' + (response.units.length > 1 ? (key+1) : '정보'),
        value: diffString,
        inline: true
      });
    });

    if(response.stat_diff) {
      let diffString = '';
      diffString += `**\`전투력\`** ${response.stat_diff.power}\n`;
      if(response.stat_diff.hp != 0) diffString += `**\`HP\`** ${response.stat_diff.hp}\n`;
      if(response.stat_diff.atk != 0) diffString += `**\`물리 공격력\`** ${response.stat_diff.atk}\n`;
      if(response.stat_diff.magic_str != 0) diffString += `**\`마법 공격력\`** ${response.stat_diff.magic_str}\n`;
      if(response.stat_diff.def != 0) diffString += `**\`물리 방어력\`** ${response.stat_diff.def}\n`;
      if(response.stat_diff.magic_def != 0) diffString += `**\`마법 방어력\`** ${response.stat_diff.magic_def}\n`;
      if(response.stat_diff.physical_critical != 0) diffString += `**\`물리 크리티컬\`** ${response.stat_diff.physical_critical}\n`;
      if(response.stat_diff.magic_critical != 0) diffString += `**\`마법 크리티컬\`** ${response.stat_diff.magic_critical}\n`;
      if(response.stat_diff.wave_hp_recovery != 0) diffString += `**\`HP 자동회복\`** ${response.stat_diff.wave_hp_recovery}\n`;
      if(response.stat_diff.wave_energy_recovery != 0) diffString += `**\`TP 자동회복\`** ${response.stat_diff.wave_energy_recovery}\n`;
      if(response.stat_diff.dodge != 0) diffString += `**\`회피\`** ${response.stat_diff.dodge}\n`;
      if(response.stat_diff.life_steal != 0) diffString += `**\`HP 흡수\`** ${response.stat_diff.life_steal}\n`;
      if(response.stat_diff.hp_recovery_rate != 0) diffString += `**\`회복량 상승\`** ${response.stat_diff.hp_recovery_rate}\n`;
      if(response.stat_diff.energy_recovery_rate != 0) diffString += `**\`TP 상승\`** ${response.stat_diff.energy_recovery_rate}\n`;
      if(response.stat_diff.energy_reduce_rate != 0) diffString += `**\`TP 소비감소\`** ${response.stat_diff.energy_reduce_rate}\n`;
      if(response.stat_diff.accuracy != 0) diffString += `**\`명중\`** ${response.stat_diff.accuracy}\n`;

      embed.fields.push({ name: '스테이터스 비교 (캐릭터 2 - 캐릭터 1)', value: diffString });
    }

    embed.fields.push({
      name: `인연 랭크 (${Object.keys(response.units[0].spec.love)
        .filter(key => response.units[0].spec.love[key].love_level > 1).length}개 캐릭터 적용)`,
      value:
        Object.keys(response.units[0].spec.love).map(key => {
          if(response.units[0].spec.love[key].love_level > 0)
            return '- ' +
              response.units[0].spec.love[key].unit_name +
              ': **`' + response.units[0].spec.love[key].love_level + '`** 랭크\n';
        }).join('')
    });

    embed.fields.push({
      name: `\`${config.prefix}도움말 ${this.name}\`을 입력하여 설명 확인`,
      value: '** **'
    });
    botMessage.edit('', { embed: embed });
  }
};
