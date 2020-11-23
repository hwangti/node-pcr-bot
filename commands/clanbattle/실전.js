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

    /* 매개 변수 처리 시작 */
    let argument = null;
    let mode = BATTLE_MODE_ENTER;
    let account = { owner_id: null, chess_id: null, damage: null, memo: '', state: BATTLE_MODE_HAND };

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
      if((match = argument.match(/^(\d{2,7}(\.?)\d?)$/)) !== null) {
        account.damage = parseFloat(match[0]);
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
    if(config.sheet_type !== 'MOMO')
      return message.channel.send('조수 군! 이 서버에서는 사용할 수 없는 명령어라네.\n');
    if(bossState.boss_num == null)
      return message.channel.send('조수 군! 진행중인 모집 정보가 없어!');

    /* 매개 변수 처리 완료 */


    // 모집 정보 설정
    switch(mode) {
    case BATTLE_MODE_CHECK: {
      let tempArray = [];
      Object.entries(bossState.entries).forEach(value => tempArray.push(value[1]));
      tempArray.sort((a, b) => {
        const aa = a.damage < 10000 ? a.damage * 10000 : a.damage;
        const bb = b.damage < 10000 ? b.damage * 10000 : b.damage;

        return bb - aa;
      });

      // copy from 모집.js RECRUIT_MODE_CHECK
      const match = bossState.boss_num.match(/^(([1-9][0-9]?)-)?([1-5])넴?$/);
      const namedString = match.length === 4 ?
        (match[2] ? `${match[2]}회차 ` : '') + bossNames[parseInt(match[3])-1] : '';

      let handString   = '', handCount  = 0;
      let enterString  = '', enterCount  = 0;
      let pauseString  = '', pauseCount  = 0;
      let rescueString = '', rescueCount = 0;
      let exitString   = '', exitCount   = 0;

      tempArray.forEach(entry => {
        let tempString = '';
        tempString += `<@!${entry.owner_id}>` + (entry.owner_id != entry.chess_id ? `(<@!${entry.chess_id}>)` : '');
        tempString += entry.damage != null && entry.state !== BATTLE_MODE_ENTER && entry.state !== BATTLE_MODE_EXIT ? ' ' + entry.damage : '';
        tempString += entry.memo !== '' ? ` (${entry.memo})` : '';
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
      ).trim();

      const embed = {
        color: '#6fc8d6',
        title: '보스 토벌 인원 현황',
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

      return message.channel.send({ embed: embed });
    }
    case BATTLE_MODE_HAND: {
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id))
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 대기중인 계정이야! ` +
          `(${bossState.entries[account.owner_id].state})`
        );

      bossState.entries[account.owner_id] = account;
      bossState.entries[account.owner_id].state = BATTLE_MODE_HAND;

      message.react('✅');
      break;
    }
    case BATTLE_MODE_ENTER: {
      // 계정 정보가 있으면
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id)) {
        // 계정 사용자가 일치하지 않는 경우
        if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
          return message.channel.send(
            `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이야! ` +
            `(${bossState.entries[account.owner_id].state})`
          );

        // 대기 모드라면 실전 모드로 변경
        if(bossState.entries[account.owner_id].state === BATTLE_MODE_HAND)
          bossState.entries[account.owner_id].state = BATTLE_MODE_ENTER;
        else
          return message.channel.send('조수 군! 준비중인 계정이 아니야!');
      }

      // 계정 정보가 없는 경우
      bossState.entries[account.owner_id] = account;
      bossState.entries[account.owner_id].state = BATTLE_MODE_ENTER;

      await message.guild.member(account.owner_id).roles.add('744835514003226654');
      message.react('✅');
      break;
    }
    case BATTLE_MODE_PAUSE: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니야!');

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이야! ` +
          `(${bossState.entries[account.owner_id].state})`
        );

      switch(bossState.entries[account.owner_id].state) {
      case BATTLE_MODE_ENTER: // 가장 일반적인 경우 (실전 모드에서 딜량 보고 후 퍼즈 모드)
        if(account.damage == null)
          return message.channel.send('조수 군! 딜량 정보가 없어!');

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
        return message.channel.send('조수 군! 실전중인 계정만 정보를 변경할 수 있어!');
      }

      this.execute(message, ['확인']);
      break;
    }
    case BATTLE_MODE_RESCUE: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니야!');

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이야! ` +
          `(${bossState.entries[account.owner_id].state})`
        );

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
        return message.channel.send('조수 군! 실전중인 계정만 정보를 변경할 수 있어!');
      }

      this.execute(message, ['확인']);
      break;
    }
    case BATTLE_MODE_EXIT: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니야!');

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이야! ` +
          `(${bossState.entries[account.owner_id].state})`
        );

      switch(bossState.entries[account.owner_id].state) {
      case BATTLE_MODE_ENTER:
      case BATTLE_MODE_PAUSE:
      case BATTLE_MODE_RESCUE:
        if(account.damage == null)
          return message.channel.send('조수 군! 딜량 정보가 없어!');

        if(account.damage < 10000)
          return message.channel.send('조수 군! 퇴장할때는 딜량을 일의자리까지 정확히 입력해야 해.');

        bossState.remain_hp -= account.damage;
        bossState.remain_hp = bossState.remain_hp < 0 ? 0 : bossState.remain_hp;
        bossState.entries[account.owner_id].state  = BATTLE_MODE_EXIT;
        bossState.entries[account.owner_id].damage  = account.damage;
        break;

      default:
        return message.channel.send('조수 군! 실전중인 계정만 정보를 변경할 수 있어!');
      }

      const botMessage = await message.channel.send('퇴장 처리 중이야...');
      await message.client.commands.get('입력').execute(message, [
        linked_id[account.owner_id].primary != null ? linked_id[account.owner_id].primary : '',
        String(bossState.entries[account.owner_id].damage) //, '/S'
      ]);
      botMessage.delete().then().catch(); // 퇴장 처리 중 메시지 삭제

      await message.guild.member(account.owner_id).roles.remove('744835514003226654');
      if(bossState.remain_hp <= 0) {
        message.channel.send('<@&744835514003226654> 보스가 잡혔으니 나와도 돼!');

        Object.entries(bossState.entries).forEach(value => {
          message.guild.member(value[0]).roles.remove('744835514003226654');
        });
      }
      this.execute(message, ['확인']);
      break;
    }
    case BATTLE_MODE_DELETE: {
      // 실전 정보가 없는 경우
      if(Object.prototype.hasOwnProperty.call(bossState.entries, account.owner_id) === false)
        return message.channel.send('조수 군! 실전중인 계정이 아니야!');

      // 계정 사용자가 일치하지 않는 경우
      if(bossState.entries[account.owner_id].chess_id !== account.chess_id)
        return message.channel.send(
          `조수 군! \`\`${verifiedName(bossState.entries[account.owner_id].chess_id, message)}\`\` 군이 실전중인 계정이야! ` +
          `(${bossState.entries[account.owner_id].state})`
        );

      // 계정 정보 삭제
      delete bossState.entries[account.owner_id];
      await message.guild.member(account.owner_id).roles.remove('744835514003226654');

      this.execute(message, ['확인']);
      break;
    }
    } // end of switch(mode)

    // 변경된 정보 설정 파일에 저장
    global.fn.saveConfig(`${global.dirname}/config/${message.guild.id}/config.json`, config);
  }
};

function verifiedName(memberId, message) {
  // undefined 발생 예외 처리
  const confirmId = message.guild.member(memberId);

  return confirmId !== null ? confirmId.displayName : `<@!${memberId}>`;
}
