/* eslint-disable indent */
const BATTLE_MODE_CHECK  = 'MODE_CHECK';
const BATTLE_MODE_HAND   = 'MODE_HAND';
const BATTLE_MODE_ENTER  = 'MODE_ENTER';
const BATTLE_MODE_PAUSE  = 'MODE_PAUSE';
const BATTLE_MODE_RESCUE = 'MODE_RESCUE';
const BATTLE_MODE_EXIT   = 'MODE_EXIT';
const BATTLE_MODE_DELETE = 'MODE_DELETE';

module.exports = {
  name: '실전',
  category: 'clanbattle',
  summary: '보스 참전 상태를 관리합니다.',
  description: '!손 --> !입장 or !실전 --> !대기 or !구조 --> !퇴장'
  ,
  aliases: ['손', '입장', '실전', '대기', '구조', '퇴장'],
  usages: [
    '손',
    '실전 <@멘션=나|별명> [대리계정]',
    '대기 <@멘션=나|별명> [대리계정] <딜량> [메모]',
    '구조 <@멘션=나|별명> [대리계정] [메모]',
    '퇴장 <@멘션=나|별명> [대리계정] <딜량>'
  ],
  samples: [
    '손',
    '',
    '대기 535 3초 // 만 단위 입력 또는 실제딜량',
    '구조 이리야 사망',
    '퇴장 5522552'
  ],
  cooltime: 1, // @TODO
  privileges: 1110,
  hasArgument: false,
  checkStrict: true,

  async execute(message, args) {
    const config = message.client.config.get(`${message.guild.id}_config`);
    const linked_id = config.linked_id;
    const bossNames = config.boss_names;
    let bossState = config.boss_state;
    let lastMsgId = message.client[`actualBattleMsgLastId_${message.guild.id}`];

    /* 매개 변수 처리 시작 */
    let argument = null;
    let mode = BATTLE_MODE_ENTER;
    let account = { owner_id: null, chess_id: null, damage: null, memo: '', state: BATTLE_MODE_HAND };
    let isUpdate = false;

    // 별칭 명령어 처리 (ex: !손 -> !실전 손 으로 해당되게)
    const aliasName = message.content.slice(config.prefix.length).split(/ +/g)[0];
    if(this.name !== aliasName) args.unshift(aliasName);

    // 전달된 매개 변수가 없을 때까지 실행
    while((argument = args.shift()) !== undefined) {
      let match = null;

      if(/^확인|현황|손|입장|실전|구조|대기|퇴장|삭제|취소$/.test(argument)) {
        mode =
          (['확인', '현황'].includes(argument)) ? BATTLE_MODE_CHECK :
          (['손'].includes(argument)) ? BATTLE_MODE_HAND :
          (['입장', '실전'].includes(argument)) ? BATTLE_MODE_ENTER :
          (['구조'].includes(argument)) ? BATTLE_MODE_RESCUE :
          (['대기'].includes(argument)) ? BATTLE_MODE_PAUSE :
          (['퇴장'].includes(argument)) ? BATTLE_MODE_EXIT :
          (['삭제', '취소'].includes(argument)) ? BATTLE_MODE_DELETE : BATTLE_MODE_ENTER;
        continue;
      }

      // 멤버 ID 처리 (@멘션 입력했을 경우)
      if(account.chess_id === null && (match = argument.match(/^<@!?(\d{18,})>$/)) !== null) {
        account.chess_id = match[1];
        continue;
      }

      // 닉네임으로 추정되는 문자열 처리
      const memberId = Object.keys(linked_id).find(id => linked_id[id].aliases.includes(argument));
      if(memberId !== undefined) {
        account.owner_id = memberId;
        continue;
      }

      // 딜량으로 추정되는 문자열 처리
      if((match = argument.match(/^(\d{2,8}(\.?)\d?)$/)) !== null) {
        account.damage = parseFloat(match[0]);
        continue;
      }

      // 수정할 메시지인지 확인
      if(/^\/U$/.test(argument)) {
        isUpdate = true;
        continue;
      }

      // 인식할 수 없는 문자열은 메모로 가정
      account.memo = (account.memo + ' ' + argument).trim();
    }

    // 엔트리가 없으면 자기 계정으로 할당
    if(account.chess_id !== message.author.id && account.owner_id === null) account.owner_id = account.chess_id;
    if(account.owner_id === null) account.owner_id = message.author.id;
    if(account.chess_id === null) account.chess_id = message.author.id;

    // 발견된 오류 처리
    if(bossState.boss_num == null)
      return message.channel.send('조수 군! 진행중인 모집 정보가 없다네.');

    /* 매개 변수 처리 완료 */


    // 모집 정보 설정
    switch(mode) {
    case BATTLE_MODE_CHECK: {
      let tempArray = [];
      Object.entries(bossState.entries).forEach(value => tempArray.push(value[1]));
      tempArray.sort((a, b) => { // 딜량 순위에 따라 정렬
        if(a.state === BATTLE_MODE_EXIT) return a;
        if(b.state === BATTLE_MODE_EXIT) return a;

        const aa = a.damage < 10000 ? a.damage * 10000 : a.damage;
        const bb = b.damage < 10000 ? b.damage * 10000 : b.damage;

        return bb - aa;
      });

      const match = bossState.boss_num.match(/^(([1-9][0-9]?)-)?([1-5])넴?$/);
      const namedString = match.length === 4 ?
        (match[2] ? `${match[2]}회차 ` : '') + bossNames[parseInt(match[3])-1] : '';

      let handString   = '', handCount   = 0;
      let enterString  = '', enterCount  = 0;
      let pauseString  = '', pauseCount  = 0;
      let rescueString = '', rescueCount = 0;
      let exitString   = '', exitCount   = 0;

      tempArray.forEach(entry => {
        let tempString = '';
        tempString += `<@!${entry.owner_id}>` + (entry.owner_id != entry.chess_id ? `(<@!${entry.chess_id}>)` : '');
        tempString += entry.damage != null && entry.state !== BATTLE_MODE_ENTER ? ' ' + global.fn.numberFormat(entry.damage) : '';
        tempString += entry.memo !== '' && entry.state !== BATTLE_MODE_EXIT ? ` (${entry.memo})` : '';
        tempString += entry.state === BATTLE_MODE_PAUSE ? '\n' : ' ';

        switch(entry.state) {
        case BATTLE_MODE_HAND:   handString   += tempString; ++handCount;   break;
        case BATTLE_MODE_ENTER:  enterString  += tempString; ++enterCount;  break;
        case BATTLE_MODE_PAUSE:  pauseString  += tempString; ++pauseCount;  break;
        case BATTLE_MODE_RESCUE: rescueString += tempString; ++rescueCount; break;
        case BATTLE_MODE_EXIT:   exitString   += tempString; ++exitCount;   break;
        }
      });
      const embedString = (
        (pauseCount + enterCount + rescueCount > 0 ? `**🔹입장 완료 (${pauseCount+enterCount+rescueCount})**\n` : '') +
        (pauseCount > 0 ?  `${pauseString}\n` : '') +
        (enterCount > 0 ?  `진행: ${enterString}\n` : '') +
        (rescueCount > 0 ? `구조: ${rescueString}\n` : '') +
        '\n' +
        (exitCount > 0 ? `**🔹실전 완료 (퇴장) (${exitCount})**\n${exitString}\n\n` : '') +
        (handCount > 0 ? `**🔹입장 대기 중 (${handCount})**\n${handString}\n\n` : '')
      ).trim().replace('\n\n\n', '\n\n');

      const embed = {
        color: '#6fc8d6',
        title: '보스 토벌 인원 현황',
        footer: { text: '설명: ✋손 ▶️입장 ⏸️대기 🏁퇴장 🆘구조 ❌삭제' },
        fields: []
      };
      embed.fields.push({ name: '네임드 정보', value: namedString, inline: true });
      embed.fields.push({ name: '잔여 보스 HP', value: global.fn.numberFormat(bossState.remain_hp), inline: true });
      embed.fields.push({
        name:
          '참여자 목록 ' +
          `(${enterCount+pauseCount+rescueCount+exitCount}/${handCount+enterCount+pauseCount+rescueCount+exitCount})`,
        value: embedString.trim() != '' ? embedString: '(없음)'
      });

      // 메시지 전송 또는 수정
      let botMessage = null;
      let isSuccess = false;
      if(isUpdate && lastMsgId) {
        try {
          botMessage = await message.client.channels.cache.get(lastMsgId[0]).messages.fetch(lastMsgId[1]);
          botMessage.edit({ embed: embed });
          isSuccess = true;
        } catch(e) { /* do nothing */ }
      }

      if(isSuccess === false) {
        if(lastMsgId) {
          // 이전 메시지의 리액션이 있다면 모두 삭제
           try {
            botMessage = await message.client.channels.cache.get(lastMsgId[0]).messages.fetch(lastMsgId[1]);
            botMessage.reactions.removeAll();
          } catch(e) { /* do nothing */ }
        }
        botMessage = await message.channel.send({ embed: embed });
        message.client[`actualBattleMsgLastId_${message.guild.id}`] = [botMessage.channel.id, botMessage.id]; // 메시지 id 저장
        const collector = botMessage.createReactionCollector(
          reaction => emoji.includes(reaction.emoji.name), { time: 7200*1000 }
        );

        // 리액션 등록 (나중에 제거하기 쉽게 먼저)
        const emoji = ['✋', '▶️', '⏸️', '🏁', '🆘', '❌'];
        emoji.forEach(emoji => botMessage.react(emoji));

        collector.on('collect', async (reaction, user) => {
          if(user.bot === true) return; // 봇 리액션 무시
          message.author = user; // 리액션 정보로 해당 유저 설정

          switch(reaction.emoji.name) {
            case emoji[0]: this.execute(message, ['손', '/U']); break;
            case emoji[1]: this.execute(message, ['실전', '/U']); break;
            case emoji[2]: {
              const prompt = await message.channel.send(`<@!${user.id}> 군! 현재 딜량을 입력해주게나. (20초 이내)`);
              message.channel
                .awaitMessages(m => user.id === m.author.id, { max: 1, time: 20000, errors: ['time'] })
                .then(async answer => {
                  this.execute(message, ['대기', '/U'].concat(answer.first().content.trim().split(/ +/g)));
                  prompt.delete().then().catch();
                  answer.first().delete().then().catch();
                })
                .catch(() => prompt.delete());
              break;
            }
            case emoji[3]: {
              const prompt = await message.channel.send(`<@!${user.id}> 군! 실전 딜량을 정확하게 입력해주게나. (시트 입력됨, 30초 이내)`);
              message.channel
                .awaitMessages(m => user.id === m.author.id, { max: 1, time: 30000, errors: ['time'] })
                .then(async answer => {
                  this.execute(message, ['퇴장', '/U', answer.first().content.trim()]);
                  prompt.delete().then().catch();
                  answer.first().delete().then().catch();
                })
                .catch(() => prompt.delete().then().catch());
              break;
            }
            case emoji[4]: {
              const prompt = await message.channel.send(`<@!${user.id}> 군! 구조 상황을 입력해주게나. (20초 이내)`);
              message.channel
                .awaitMessages(m => user.id === m.author.id, { max: 1, time: 20000, errors: ['time'] })
                .then(async answer => {
                  this.execute(message, ['구조', '/U'].concat(answer.first().content.trim().split(/ +/g)));
                  prompt.delete().then().catch();
                  answer.first().delete().then().catch();
                })
                .catch(() => prompt.delete().then().catch());
              break;
            }
            case emoji[5]: {
              const prompt = await message.channel.send(`<@!${user.id}> 군! 실전 기록을 삭제할건가? (10초 이내)`);
              await prompt.react('⭕');
              await prompt.react('❌');

              const filter = (reaction, u) => ['⭕', '❌'].includes(reaction.emoji.name) && u.id === user.id;
              prompt.awaitReactions(filter, { max: 1, time: 10000, errors: ['time'] })
                .then(collected => {
                  if(collected.first().emoji.name === '⭕')
                    this.execute(message, ['삭제', '/U']);
                  prompt.delete().then().catch();
                })
                .catch(() => prompt.delete().then().catch());
              break;
            }
          }
          reaction.users.remove(user.id).then().catch();
        });
        collector.on('end', collected => {
          if(collected.length) collected.first().message.reactions.removeAll().then().catch();
        });
      }
      return;
    }
    case BATTLE_MODE_HAND: {
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id))
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 대기중인 계정이라네. ` +
          `(${bossState.entries[account.owner_id].state})`
        ).then(m => m.delete({ timeout: 7500 })).catch();

      bossState.entries[account.owner_id] = account;
      bossState.entries[account.owner_id].state = BATTLE_MODE_HAND;
      break;
    }
    case BATTLE_MODE_ENTER: {
      // 계정 정보가 있으면
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id)) {
        // 계정 사용자가 일치하지 않는 경우
        if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
          return message.channel.send(
            `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이라네. ` +
            `(${bossState.entries[account.owner_id].state})`
          ).then(m => m.delete({ timeout: 7500 })).catch();

        // 대기 모드라면 실전 모드로 변경
        if(bossState.entries[account.owner_id].state === BATTLE_MODE_HAND)
          bossState.entries[account.owner_id].state = BATTLE_MODE_ENTER;
        else
          return message.channel.send('조수 군! 준비중인 계정이 아니라네.').then(m => m.delete({ timeout: 7500 })).catch();
      }

      // 계정 정보가 없는 경우
      bossState.entries[account.owner_id] = account;
      bossState.entries[account.owner_id].state = BATTLE_MODE_ENTER;
      break;
    }
    case BATTLE_MODE_PAUSE: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니라네.').then(m => m.delete({ timeout: 7500 })).catch();

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이라네. ` +
          `(${bossState.entries[account.owner_id].state})`
        ).then(m => m.delete({ timeout: 7500 })).catch();

      switch(bossState.entries[account.owner_id].state) {
      case BATTLE_MODE_ENTER: // 가장 일반적인 경우 (실전 모드에서 딜량 보고 후 퍼즈 모드)
        if(account.damage == null)
          return message.channel.send('조수 군! 딜량 정보가 없다네.').then(m => m.delete({ timeout: 7500 })).catch();

        bossState.entries[account.owner_id].state  = BATTLE_MODE_PAUSE;
        bossState.entries[account.owner_id].damage = account.damage;
        bossState.entries[account.owner_id].memo   = account.memo;
        break;

      case BATTLE_MODE_PAUSE: // 퍼즈 모드에서 딜 입력이나 메모를 수정하는 경우
        if(account.damage != null) bossState.entries[account.owner_id].damage = account.damage;
        if(account.memo   != '')   bossState.entries[account.owner_id].memo   = account.memo;
        break;

      case BATTLE_MODE_RESCUE: // 구조 모드에서 대기 모드로 변경하는 경우
        bossState.entries[account.owner_id].state  = BATTLE_MODE_PAUSE;
        if(account.damage != null) bossState.entries[account.owner_id].damage = account.damage;
        if(account.memo   != '')   bossState.entries[account.owner_id].memo   = account.memo;
        break;

      default:
        return message.channel.send('조수 군! 실전중인 계정만 정보를 변경할 수 있다네.').then(m => m.delete({ timeout: 7500 })).catch();
      }

      break;
    }
    case BATTLE_MODE_RESCUE: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니라네.').then(m => m.delete({ timeout: 7500 })).catch();

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이라네. ` +
          `(${bossState.entries[account.owner_id].state})`
        ).then(m => m.delete({ timeout: 7500 })).catch();

      switch(bossState.entries[account.owner_id].state) {
      case BATTLE_MODE_ENTER: // 가장 일반적인 경우 (실전 모드에서 딜량 보고 후 구조 모드)
        bossState.entries[account.owner_id].state  = BATTLE_MODE_RESCUE;
        bossState.entries[account.owner_id].damage = account.damage;
        bossState.entries[account.owner_id].memo   = account.memo;
        break;

      case BATTLE_MODE_PAUSE: // 대기 모드에서 구조 모드로 변경하는 경우
        bossState.entries[account.owner_id].state  = BATTLE_MODE_RESCUE;
        if(account.damage != null) bossState.entries[account.owner_id].damage = account.damage;
        if(account.memo   != '')   bossState.entries[account.owner_id].memo   = account.memo;
        break;

      case BATTLE_MODE_RESCUE: // 구조 모드에서 딜 입력이나 메모를 수정하는 경우
        if(account.damage != null) bossState.entries[account.owner_id].damage = account.damage;
        if(account.memo   != '')   bossState.entries[account.owner_id].memo   = account.memo;
        break;

      default:
        return message.channel.send('조수 군! 실전중인 계정만 정보를 변경할 수 있다네.').then(m => m.delete({ timeout: 7500 })).catch();
      }

      break;
    }
    case BATTLE_MODE_EXIT: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니라네.').then(m => m.delete({ timeout: 7500 })).catch();

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이라네. ` +
          `(${bossState.entries[account.owner_id].state})`
        ).then(m => m.delete({ timeout: 7500 })).catch();

      switch(bossState.entries[account.owner_id].state) {
      case BATTLE_MODE_ENTER:
      case BATTLE_MODE_PAUSE:
      case BATTLE_MODE_RESCUE:
        if(account.damage == null)
          return message.channel.send('조수 군! 딜량 정보가 없다네.').then(m => m.delete({ timeout: 7500 })).catch();

        if(account.damage < 10000)
          return message.channel.send('조수 군! 퇴장할때는 딜량을 일의자리까지 정확히 입력해야 한다네.').then(m => m.delete({ timeout: 7500 })).catch();

        bossState.remain_hp -= account.damage;
        bossState.remain_hp = bossState.remain_hp < 0 ? 0 : bossState.remain_hp;
        bossState.entries[account.owner_id].state  = BATTLE_MODE_EXIT;
        bossState.entries[account.owner_id].damage  = account.damage;
        break;

      default:
        return message.channel.send('조수 군! 실전중인 계정만 정보를 변경할 수 있다네.').then(m => m.delete({ timeout: 7500 })).catch();
      }

      const botMessage = await message.channel.send('퇴장 처리 및 시트 입력 중이야...');
      const result = await message.client.commands.get('입력').execute(message, [
        linked_id[account.owner_id].primary != null ? linked_id[account.owner_id].primary : '',
        String(bossState.entries[account.owner_id].damage), '/S'
      ]);
      message.channel.send({ embed: result }).then(m => m.delete({ timeout: 10000 }));
      botMessage.delete(); // 퇴장 처리 중 메시지 삭제

      if(bossState.remain_hp <= 0) {
        let mensionString = '';
        Object.keys(bossState.entries).forEach(id => {
          if([BATTLE_MODE_ENTER, BATTLE_MODE_PAUSE, BATTLE_MODE_RESCUE].includes(bossState.entries[id].state))
            mensionString += ` <@!${bossState.entries[id].chess_id}>`.trim();
        });
        if(mensionString.length > 10)
          message.channel.send(`${mensionString}, 보스가 잡혔으니 나와도 돼!`);
        const botMessage = await message.client.channels.cache.get(lastMsgId[0]).messages.fetch(lastMsgId[1]);
        botMessage.reactions.removeAll();
      }
      break;
    }
    case BATTLE_MODE_DELETE: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니라네.').then(m => m.delete({ timeout: 7500 })).catch();

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이라네. ` +
          `(${bossState.entries[account.owner_id].state})`
        ).then(m => m.delete({ timeout: 7500 })).catch();

      // 계정 정보 삭제
      delete bossState.entries[account.owner_id];
      break;
    }
    } // end of switch(mode)

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/config.json`, config);
    isUpdate ? this.execute(message, ['확인', '/U']) : this.execute(message, ['확인']);
  }
};

function verifiedName(memberId, message) {
  // undefined 발생 예외 처리
  const confirmId = message.guild.member(memberId);

  return confirmId !== null ? confirmId.displayName : `<@!${memberId}>`;
}
