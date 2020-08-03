const RUSSIAN_ROULETTE_READY = 1;
const RUSSIAN_ROULETTE_PLAYING = 2;
const RUSSIAN_ROULETTE_END = 3;

module.exports = {
  name: '러시안룰렛',
  summary: '러시안 룰렛 게임입니다.',
  description:
    '> `시작`: 러시안 룰렛 게임 방을 만듭니다.\n' +
    '- 최대 참가 인원은 19명, 모집 시간은 39초, 불발률은 0~99%까지 지정 가능합니다.\n' +
    '- 인원, 모집 시간, 블발률을 지정하지 않으면 기본 값으로 설정되며, 게임 옵션에 `명`(생략 가능), `초`, `%`가 들어가면 해당하는 옵션으로 인식됩니다.\n' +
    '- 불발률은 방아쇠를 당겼지만 발사되지 않을 확률입니다. (5%면 5% 확률로 불발탄)\n\n' +
    '> `참가`, `참여`: `시작` 옵션으로 만든 방을 참가합니다.\n' +
    '> `당겨`, `쏘기`: 러시안 룰렛 게임 시작 후 방아쇠를 당길 때 사용합니다.'
  ,
  aliases: ['러시안', '룰렛'],
  usages: [
    '시작 [인원=6명] [모집_시간=30초] [불발률=5%]',
    '<참가|참여>',
    '<당겨|쏘기>'
  ],
  samples: [
    '시작 6명 30초 5%',
    '참가',
    '당겨'
  ],
  hasArgument: true,
  privileges: 1111,

  async execute(message, args) {
    const mode = args.shift();

    // 룰렛 설정이 없으면 추가
    if(message.client.config.get(`${message.guild.id}_roulette`) == null)
      message.client.config.set(`${message.guild.id}_roulette`, {});
    const config = message.client.config.get(`${message.guild.id}_config`);
    const roulette = message.client.config.get(`${message.guild.id}_roulette`);

    switch(mode) {
    case '시작': {
      if(roulette.state === RUSSIAN_ROULETTE_READY)
        return message.channel.send('오류: 준비중인 게임이 있습니다.');
      if(roulette.state === RUSSIAN_ROULETTE_PLAYING)
        return message.channel.send('오류: 이미 게임이 진행중입니다.');

      // 기본 설정 값
      roulette.state = RUSSIAN_ROULETTE_READY;
      roulette.memberCount = 6;
      roulette.timeCount = 30;
      roulette.missfireRate = 5; // 5%
      roulette.startTime = Date.now() + 1000; // 네트워크 딜레이 반영
      roulette.endTime = roulette.startTime + roulette.timeCount;
      roulette.memberIndex = 0;
      roulette.members = [];

      let argument;
      let errorString = '';

      // 매개 변수 설정
      while((argument = args.shift()) !== undefined) {
        let match = null;

        // 모집 인원 설정
        if((match = argument.match(/^([0-1]?[0-9])명?$/)) !== null) {
          roulette.memberCount = parseInt(match[1]);
          continue;
        }

        // 모집 시간 설정
        if((match = argument.match(/^([0-5]?[0-9])초$/)) !== null) {
          roulette.timeCount = parseInt(match[1]);
          continue;
        }

        // 불발률 설정
        if((match = argument.match(/^([0-9]{1,2})(%|퍼)$/)) !== null) {
          roulette.missfireRate = parseInt(match[1]);
          continue;
        }

        // 나머지 문자열은 미인식 처리
        errorString += `오류: 인식할 수 없는 문자열입니다. \`${argument}\`\n`;
      }

      if(errorString !== '')
        return message.channel.send(errorString);

      return message.channel.send(
        `러시안 룰렛을 시작합니다. \`${config.prefix}${this.name} 참가\`를 입력해서 참가할 수 있습니다.`,
        {
          embed: {
            title: '룰렛 설정 확인',
            fields: [
              { name: '최대 참여 인원', value: `${roulette.memberCount}명`, inline: true },
              { name: '모집 시간', value: `${roulette.timeCount}초`, inline: true },
              { name: '불발률', value: `${roulette.missfireRate}%`, inline: true }
            ]
          }
        }
      ).then(() => {
        message.channel
          // eslint-disable-next-line no-unused-vars
          .awaitMessages(m => true, { max: 1000, time: roulette.timeCount * 1000, errors: ['time'] })
          .then(() => {
            // do nothing
          }).catch(async () => {
            if(roulette.members.length < 2) {
              roulette.state = RUSSIAN_ROULETTE_END;
              return message.channel.send('참여 인원이 없으므로 게임을 종료합니다.');
            }

            // 게임 중이거나 이미 종료됐으면 무시
            if(roulette.state === RUSSIAN_ROULETTE_PLAYING) return;
            if(roulette.state === RUSSIAN_ROULETTE_END) return;

            await this.execute(message, ['GAME_START']);

            return message.channel.send('모집 시간이 지났습니다. 게임을 시작합니다.', { embed: {
              description: `<@!${roulette.members[roulette.memberIndex]}>님의 차례입니다.`
            }});
          });
      });
    }
    case '참가':
    case '참여': {
      if(roulette == null || roulette.state == null || roulette.state == RUSSIAN_ROULETTE_END)
        return message.channel.send('오류: 진행중인 게임이 없습니다.');

      if(roulette.STATE == RUSSIAN_ROULETTE_PLAYING)
        return message.channel.send('오류: 이미 게임이 진행중입니다.');

      if(roulette.members.includes(message.author.id))
        return message.channel.send('오류: 이미 참여했습니다.');

      if(roulette.memberCount <= roulette.members.length)
        return message.channel.send('오류: 더 이상 참여할 수 없습니다.');

      roulette.members.push(message.author.id);
      message.channel.send('참가 완료', { embed: {
        title: '러시안 룰렛 참가자',
        description: roulette.members.map(id => `<@!${id}>`).join(' ')
      }});

      if(roulette.memberCount <= roulette.members.length) {
        await this.execute(message, ['GAME_START']);

        return message.channel.send('모집이 마감되었습니다. 게임을 시작합니다.', { embed: {
          description: `<@!${roulette.members[roulette.memberIndex]}>님의 차례입니다.`
        }});
      }
      return;
    }
    case '당겨':
    case '쏘기': {
      if(roulette == null || roulette.state == null || roulette.state != RUSSIAN_ROULETTE_PLAYING)
        return message.channel.send('오류: 진행중인 게임이 없습니다.');

      if( roulette.state == RUSSIAN_ROULETTE_PLAYING &&
        roulette.members[roulette.memberIndex] !== message.author.id)
        return message.reply('오류: 방아쇠를 당길 순서가 아닙니다. 차례를 기다려주세요.');

      // R.I.P
      if(roulette.bullets[roulette.memberIndex] === 1) {
        roulette.state = RUSSIAN_ROULETTE_END;
        return message.reply(':skull_crossbones:');
      }

      ++roulette.memberIndex;
      if(roulette.memberIndex === roulette.members.length) {
        await this.execute(message, ['GAME_START']);

        return message.channel.send('마지막 탄환이었지만 불발탄이었습니다! 총알을 다시 장전합니다.', { embed: {
          description: `<@!${roulette.members[roulette.memberIndex]}>님의 차례입니다.`
        }});
      }

      return message.channel.send('방아쇠를 당겼지만 아무 일도 일어나지 않았습니다.', { embed: {
        description: `<@!${roulette.members[roulette.memberIndex]}>님의 차례입니다.`
      }});
    }
    case '종료': {
      // if(roulette.state != RUSSIAN_ROULETTE_END)
      //   return message.channel.send('오류: 진행중인 게임이 없습니다.');

      roulette.state = RUSSIAN_ROULETTE_END;
      return message.channel.send('진행중인 게임을 종료했습니다.');
    }
    case 'GAME_START': {
      // 총알 장전
      roulette.bullets = new Array(roulette.members.length).fill(0);
      if(Math.random() > roulette.missfireRate / 100)
        roulette.bullets[Math.floor(Math.random() * roulette.members.length)] = 1;

      // 시작 순서 정하기
      shuffleArray(roulette.members);

      // 게임 시작
      roulette.memberIndex = 0;
      roulette.state = RUSSIAN_ROULETTE_PLAYING;

      // console.log(random);
      // console.log(roulette);
      return;
    }
    }

    function shuffleArray(array) {
      for(let i=array.length-1; i>0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
    }
  }


};
