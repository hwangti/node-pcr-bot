const crypto = require('crypto');
const fetch = require('node-fetch');
const FormData = require('form-data');
const units = require('../config/_units.json');

const SITE_NOMAE = 'https://nomae.net/arenadb/';
const SITE_PCRD  = 'https://www.pcrdfans.com/battle';

module.exports = {
  name: '아레나',
  summary: '아레나 DB에서 정보를 검색합니다.',
  description:
    '방어 대상 캐릭터를 순서에 관계없이 입력하면 됩니다. 정식 명칭, 별명 모두 사용 가능합니다.\n\n' +
    '캐릭터와 마찬가지로 `일본` 이나 `중국`을 입력하면 검색할 사이트를 지정할 수 있습니다.\n' +
    '**(주의: 게임 서버가 아니라 아레나 DB 사이트 입니다.)**' +
    '- `일본`, `jp`: https://nomae.net/arenadb/ 에서 검색합니다. (일본 사이트)\n' +
    '- `중국`, `cn`: https://www.pcrdfans.com/battle 에서 검색합니다. (중국 사이트)\n' +
    '기본 검색 사이트는 `중국` (pcrdfans) 입니다.'
  ,
  aliases: ['arena'],
  usages: ['[사이트] [캐릭터 ...]'],
  samples: ['리마 푸딩 쿠우카 츠무기 마호', '일본 리마 푸딩 쿠우카 츠무기 마호'],
  privileges: 1111,

  async execute(message, args) {
    let server = SITE_PCRD;
    let chars = [];

    let argument = null;
    let errorString = '';

    while((argument = args.shift()) !== undefined) {
      // 서버로 추정되는 문자열 처리
      if(['일본', 'jp'].includes(argument.toLowerCase())) { server = SITE_NOMAE; continue; }
      if(['중국', 'cn'].includes(argument.toLowerCase())) { server = SITE_PCRD; continue; }

      // 캐릭터로 추정되는 문자열 처리
      if(/^[()가-힣]+$/.test(argument)) {
        let unitId = Object.keys(units).find(id => units[id].unit_alias.includes(argument));

        if(unitId == null) {
          errorString += `조수 군! 캐릭터 정보를 찾을 수 없다네. \`${argument}\`\n`;
          break;
        }

        chars.push({
          id: unitId * 100 + 1,
          name_kor: units[unitId].unit_name,
          name_jpn: units[unitId].unit_kana,
        });
        continue;
      }

      // 나머지 문자열은 미인식 처리
      errorString += `조수 군! 무슨 말인지 모르겠다네. \`${argument}\`\n`;
    }

    // 발견된 오류 처리
    if(chars.length === 0)
      errorString += '조수 군! 캐릭터를 입력하지 않았다네.\n';
    if(chars.length > 5)
      errorString += '조수 군! 캐릭터를 5개 이하로 입력해주게나.\n';
    if(errorString.length > 0)
      return message.channel.send(errorString);


    let response = null;
    let hasError = false;

    const embed = {
      title: '아레나 DB',
      timestamp: Date.now(),
      footer: { text: `Data by ${server}` },
      description: '** 🔹방어 대상 캐릭터 ** \n- ' + chars.map(value => value.name_kor).join(' ') + '\n\n ** 🔹검색 결과 **',
      fields: []
    };
    const botMessage = await message.channel.send('조수 군의 요청을 알아보고 있다네...');


    switch(server) {
    case SITE_PCRD: {
      const body = {
        def: chars.map(value => value.id),
        nonce: Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10),
        page: 1,
        region: 1,
        sort: 3,
        ts: parseInt(String(+new Date()).substr(0, 10))
      };
      body._sign = crypto.createHash('md5').update(JSON.stringify(body) + 'e437591b87a9e7d10b7ad73465bbc0e9' + body.nonce).digest('hex');

      await fetch('https://api.pcrdfans.com/x/v1/search', {
        headers: {
          // 'authorization': '',
          // 'content-type': 'application/json',
          // 'sec-fetch-dest': 'empty',
          // 'sec-fetch-mode': 'cors',
          // 'sec-fetch-site': 'same-site',
          // 'cookie': '__cfduid=dc8091adddd020d556c341891c3f6b7331592422103'
        },
        referrer: 'https://www.pcrdfans.com/battle',
        referrerPolicy: 'no-referrer-when-downgrade',
        body: JSON.stringify(body),
        method: 'POST',
        mode: 'cors'
      })
        .then(res => res.json())
        .then(json => response = json)
        .catch(err => {
          hasError = true;
          console.error(err);
          return botMessage.edit(`조수 군, 명령어를 실행하는 중에 오류가 발생한 것 같다네...\n\`\`\`${err.name + ' ' + err.type}\`\`\``);
        });

      if(hasError) return;
      if(response.code !== 0)
        return botMessage.edit(`조수 군! 서버에서 오류가 발생했다네.\n\`\`\`${response.message}\`\`\``);
      if(response.data.result.length === 0)
        return botMessage.edit('조수 군! 검색 결과가 없다고 하네.');

      response.data.result.map(value => {
        let embedName = '';
        let embedValue = '';

        value.atk.map(val => {
          const unitId4 = String(val.id).substring(0, 4);

          embedName += (units[unitId4] == null ? val.id : units[unitId4].unit_name) + ' ';
        });

        embedValue = `🔺${value.up} 🔻${value.down} [${value.updated.substring(0, 10)}]`;
        embed.fields.push({ name: embedName, value: embedValue });
      });

      break;
    }
    case SITE_NOMAE: {
      const body = new FormData();
      body.append('type', 'search');
      body.append('userid', 0);
      body.append('public', 1);
      body.append('page', 0);
      body.append('sort', 0);
      chars.map(value => body.append('def[]', value.name_jpn));

      await fetch('https://nomae.net/princess_connect/public/_arenadb/receive.php', {
        method: 'POST',
        body: body,
        headers: {
          'x-from': 'https://nomae.net/arenadb/',
          'x-requested-width': 'XMLHttpRequest'
        }
      })
        .then(res => res.json())
        .then(json => response = json)
        .catch(err => {
          hasError = true;
          if(err.type === 'invalid-json')
            return botMessage.edit(
              '현재 액세스가 집중되고 있습니다. 시간을 두고 다시 시도해 주십시오.\n' +
              '現在、アクセスが集中しています。時間を置き、再度お試しください。');
          else {
            console.error(err);
            return botMessage.edit(`조수 군, 명령어를 실행하는 중에 오류가 발생한 것 같다네...\n\`\`\`${err.name + ' ' + err.type}\`\`\``);
          }
        });

      if(hasError) return;
      if(response.msg)
        return botMessage.edit(`조수 군! 서버에서 오류가 발생했다네.\n\`\`\`${response.msg}\`\`\``);
      if(response.length === 0)
        return botMessage.edit('조수 군! 검색 결과가 없다고 하네.');

      response.map(value => {
        const charStr = value.atk.split('/');
        charStr.shift(); // 0번 인덱스의 값은 '' 이므로 빈 요소 제거
        let embedName = '';
        let embedValue = '';

        charStr.map(val => {
          const char = val.split(',')[0];
          const unitId = Object.keys(units).find(id => units[id].unit_alias.includes(char));

          embedName += unitId == null ? char : units[unitId].unit_name + ' ';
        });

        embedValue = `🔺${value.good} 🔻${value.bad} [${value.updated.substring(0, 10)}]`;
        embed.fields.push({ name: embedName, value: embedValue });
      });

      break;
    } // end of case
    } // end of switch

    botMessage.edit('', { embed: embed });
  }
};
