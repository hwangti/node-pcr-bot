module.exports = {
  name: '설정',
  category: 'system',
  summary: '봇 설정을 관리합니다.',
  description:
    '> `확인`: 봇 설정을 모두 표시합니다.\n' +
    '> `저장`, `save`: 봇 설정을 파일에 저장합니다.\n' +
    '> `로드`, `load`: 파일에서 봇 설정을 다시 불러옵니다.\n' +
    '> `접두사`: 명령어를 구분할 문자열을 설정합니다. (기본값: `!`)\n' +
    '> `관리자등록`, `관리자삭제`: 봇 설정을 변경할 멤버를 설정하거나 삭제합니다.\n' +
    '> `채널등록`, `채널삭제`: 명령어가 동작할 채널을 추가하거나 삭제합니다.\n' +
    '> `역할등록`, `역할삭제`: 일부 클랜원만 실행 가능한 명령어의 역할(Discord)을 추가하거나 삭제합니다.\n' +
    '> `시작일`: 클랜전 시작일을 설정합니다.\n' +
    '> `기간`: 클랜전 기간(진행 일수)을 설정합니다.\n' +
    '> `보스`: 클랜전 보스를 설정합니다. (각 보스는 `,` 로 구분)\n' +
    '> `시트`: 클랜 시트를 설정합니다.\n'
  ,
  aliases: ['config', 'prefs'],
  usages: ['<옵션> [설정값]'],
  privileges: 1100,
  hasArgument: true,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const sheetConfig = message.client.config.get(`${message.guild.id}_sheets`);

    const argument = args.shift();

    switch(argument) {
    case '확인': {
      return message.channel.send({ embed: {
        color: '#F4B400',
        title: '봇 설정 확인',
        fields: [
          { name: '접두사', value: `\`${config.prefix}\`<명령어>` },
          {
            name: '작동 채널 및 권한',
            value:
              '- 관리자: ' + config.admin_user_ids.map(id => `<@!${id}>`).join(' ') + '\n' +
              '- 채　널: ' + config.action_channel_ids.map(id => `<#${id}>`).join(' ') + '\n' +
              '- 역　할: ' + config.action_roles_ids.map(id => `<@&${id}>`).join(' ')
          },
          {
            name: '클랜전',
            value:
              '- 시작일: `' + config.clanbattle_start_time + '`\n' +
              '- 기　간: `' + config.clanbattle_duration_day + '`일\n' +
              '- 보스명: `' + config.boss_names.join(', ') + '`'
          },
          {
            name: '클랜 시트',
            value:
              '- 작동 방식: `' + config.sheet_type.toUpperCase() + '`\n' +
              '- 시트 주소: https://docs.google.com/spreadsheets/d/' + sheetConfig.spreadsheet_id
          },
          {
            name: '봇 통계',
            value:
              '- 서버 (' + message.client.guilds.cache.size + '개), 멤버 (' + message.client.users.cache.size + '명)\n' +
              '- 명령어 수: ' + config.command_count + '회\n' +
              '- 채팅 수: ' + config.chat_count + '회'
          }
        ],
        footer: { text: '옴닉 ' + message.client.version },
        timestamp: message.client.updateTime
      }});
    }
    case '저장':
    case 'save': {
      message.channel.send('설정을 저장했다네.');
      break;
    }
    case '로드':
    case 'load': {
      ['config', 'sheets', 'units'].map(file => {
        delete require.cache[require.resolve(`${global.dirname}/config/${message.guild.id}/${file}.json`)];

        message.client.config.set(
          `${message.guild.id}_${file}`,
          require(`${global.dirname}/config/${message.guild.id}/${file}.json`)
        );
      });

      console.log(`${global.dateFormat()} [INFO] 설정 로드`);
      return message.channel.send('설정을 불러왔다네.');
    }
    case '접두사': {
      if(args[0] === undefined || args[0] === '확인')
        return message.channel.send({ embed: {
          color: '#F4B400',
          title: '접두사',
          description: config.prefix
        }});

      const prefix = args.join(' ').trim();
      if(prefix.length > 2)
        return message.channel.send('조수 군! 접두사는 2글자 이내로 입력해주게나.');

      config.prefix = prefix;
      message.channel.send('설정된 접두사: `' + config.prefix + '`');
      break;
    }
    case '관리자':
      if(['등록', '삭제'].includes(args[0]))
        return message.channel.send(
          '관리자 등록/삭제 명령어는 다음과 같습니다.\n```\n' +
          `${config.prefix}${this.name} 관리자등록 <@멘션>\n` +
          `${config.prefix}${this.name} 관리자삭제 <@멘션>` + '```\n'
        );

      if(config.admin_user_ids.length === 0)
        return message.channel.send('조수 군! 등록된 관리자가 없다네.');
      return message.channel.send({ embed: {
        color: '#F4B400',
        title: '관리자 목록',
        description: config.admin_user_ids.map(id => `<@!${id}>`).join(' ')
      }});
    case '관리자등록': {
      const memberId = args.join(' ').trim();
      let match = null;
      if((match = memberId.match(/^<@!?(\d{18,})>$/)) === null)
        return message.channel.send('조수 군! 등록할 멤버를 한 명씩 `@멘션`으로 입력해주게나.');

      config.admin_user_ids.push(match[1]);
      config.admin_user_ids = [...new Set(config.admin_user_ids)];

      this.execute(message, ['관리자']);
      break;
    }
    case '관리자삭제': {
      const memberId = args.join(' ').trim();
      let match = null;
      if((match = memberId.match(/^<@!?(\d{18,})>$/)) === null)
        return message.channel.send('조수 군! 삭제할 멤버를 한 명씩 `@멘션`으로 입력해주게나.');

      config.admin_user_ids = config.admin_user_ids.filter(value => value !== match[1]);

      this.execute(message, ['관리자']);
      break;
    }
    case '채널':
      if(['등록', '삭제'].includes(args[0]))
        return message.channel.send(
          '채널 등록/삭제 명령어는 다음과 같다네.\n```\n' +
          `${config.prefix}${this.name} 채널등록 <#채널>\n` +
          `${config.prefix}${this.name} 채널삭제 <#채널>` + '```\n'
        );

      if(config.action_channel_ids.length === 0)
        return message.channel.send('조수 군! 등록된 채널이 없다네.');
      return message.channel.send({ embed: {
        color: '#F4B400',
        title: '채널 목록',
        description:
          config.action_channel_ids.map(id => {
            const channel = message.guild.channels.cache.get(id);
            return channel == null ? `\\<#${id}> (없는 채널)` : `<#${id}>`;
          }).join(' ')
      }});
    case '채널등록': {
      const memberId = args.join(' ').trim();
      let match = null;
      if((match = memberId.match(/^<#(\d{18,})>$/)) === null)
        return message.channel.send('조수 군! 등록할 채널을 하나씩 `#채널`로 입력해주게나.');

      config.action_channel_ids.push(match[1]);
      config.action_channel_ids = [...new Set(config.action_channel_ids)];

      this.execute(message, ['채널']);
      break;
    }
    case '채널삭제': {
      const memberId = args.join(' ').trim();
      let match = null;
      if((match = memberId.match(/^<#(\d{18,})>$/)) === null)
        return message.channel.send('조수 군! 삭제할 채널을 하나씩 `#채널`로 입력해주게나.');

      config.action_channel_ids = config.action_channel_ids.filter(value => value !== match[1]);

      this.execute(message, ['채널']);
      break;
    }
    case '역할':
      if(['등록', '삭제'].includes(args[0]))
        return message.channel.send(
          '역할 등록/삭제 명령어는 다음과 같다네.\n```\n' +
          `${config.prefix}${this.name} 역할등록 <@멘션>\n` +
          `${config.prefix}${this.name} 역할삭제 <@멘션>` + '```\n'
        );

      if(config.action_roles_ids.length === 0)
        return message.channel.send('등록된 역할이 없다네.');
      return message.channel.send({ embed: {
        color: '#F4B400',
        title: '역할 목록',
        description: config.action_roles_ids.map(id => `<@&${id}>`).join(' ')
      }});
    case '역할등록': {
      const memberId = args.join(' ').trim();
      let match = null;
      if((match = memberId.match(/^<@&(\d{18,})>$/)) === null)
        return message.channel.send('조수 군! 등록할 역할을 하나씩 `@역할`로 입력해주게나.');

      config.action_roles_ids.push(match[1]);
      config.action_roles_ids = [...new Set(config.action_roles_ids)];

      this.execute(message, ['역할']);
      break;
    }
    case '역할삭제': {
      const memberId = args.join(' ').trim();
      let match = null;
      if((match = memberId.match(/^<@&(\d{18,})>$/)) === null)
        return message.channel.send('조수 군! 삭제할 역할을 하나씩 `@역할`로 입력해주게나.');

      config.action_roles_ids = config.action_roles_ids.filter(value => value !== match[1]);

      this.execute(message, ['역할']);
      break;
    }
    case '시작일':
    case '클랜전시작일': {
      if([undefined, '확인'].includes(args[0]))
        return message.channel.send({ embed: {
          color: '#F4B400',
          title: '클랜전 시작일',
          description: config.clanbattle_start_time
        }});

      const datetime = new Date(args.join(' ').trim());
      if(!(datetime instanceof Date) || isNaN(datetime.getTime()))
        return message.channel.send(
          '조수 군! 날짜 형식이 잘못되었다네.\n' +
          '예: `2020-03-23 15:00:00` (JavaScript 날짜 형식)'
        );

      config.clanbattle_start_time = global.dateFormat(datetime);

      this.execute(message, ['시작일']);
      break;
    }
    case '기간':
    case '클랜전기간': {
      if([undefined, '확인'].includes(args[0]))
        return message.channel.send({ embed: {
          color: '#F4B400',
          title: '클랜전 기간',
          description: config.clanbattle_duration_day + '일'
        }});

      const duration = parseInt(args.join(' ').trim());
      if(duration <= 4 || duration >= 12)
        return message.channel.send(
          '조수 군! 클랜전 기간이 잘못되었다네. (5 ~ 12)\n' +
          '예: `8`'
        );

      config.clanbattle_duration_day = duration;

      this.execute(message, ['기간']);
      break;
    }
    case '보스':
    case '클랜전보스': {
      if([undefined, '확인'].includes(args[0]))
        return message.channel.send({ embed: {
          color: '#F4B400',
          title: '클랜전 보스명',
          description: config.boss_names.join(', ')
        }});

      const bossArray = args.join(' ').trim().split(',').map(value => value.trim());
      if(bossArray.length !== 5)
        return message.channel.send(
          '조수 군! 보스명이 올바르지 않다네. 각 보스를 `,`로 구분해주게나.\n' +
          '예: `고블린 그레이트, 라이라이, 무슈후슈, 무버, 메사르팀`'
        );

      config.boss_names = bossArray;

      this.execute(message, ['보스']);
      break;
    }
    case '시트':
    case '클랜시트': {
      if([undefined, '확인'].includes(args[0]))
        return message.channel.send({ embed: {
          color: '#F4B400',
          title: '클랜 시트 주소',
          description:
            'https://docs.google.com/spreadsheets/d/' + sheetConfig.spreadsheet_id
        }});

      const match = args.join(' ').trim()
        .match(/^(https?:\/\/docs\.google\.com\/spreadsheets\/d\/)?([_\-0-9A-Za-z]{44})/);
      if(match === null)
        return message.channel.send(
          '조수 군! 클랜 시트 주소가 이상하다네.\n{시트 ID} 혹은 {주소 전체}를 입력해주게나.\n```\n' +
          '- 시트 ID: ...spreadsheets/d/{시트 ID}/edit...\n' +
          '- 또는 클랜 시트 주소 전체\n```'
        );

      sheetConfig.spreadsheet_id = match[2];

      this.execute(message, ['시트']);
      break;
    } /* end of case */
    } /* end of switch */

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/config.json`, config);
    global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/sheets.json`, sheetConfig);
  } /* end of execute() */
};
