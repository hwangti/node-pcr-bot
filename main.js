const __BOT__VERSION__ = '1.6.0';

// 인증 파일 로드
const auth = require('./config/auth.json');
global.auth = auth;

// CommonJS 모듈 로드
const fs = require('fs');
const path = require('path');

// 경로가 복잡한 모듈은 전역 변수로 지정
const dateFormat = require('./modules/dateformat');
global.dirname = __dirname;
global.dateFormat = dateFormat;
global.fn = require('./modules/functions.js');

// Discord 변수
const Discord = require('discord.js');
const client = new Discord.Client();
client.commands = new Discord.Collection();
client.config = new Discord.Collection();
const cooltimes = new Discord.Collection();


async function* getFiles(dir) {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  for(const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);
    dirent.isDirectory() ? yield* getFiles(res) : yield res;
  }
}

function initialConfig(client) {
  // 서버별로 설정 파일 로드
  client.guilds.cache.map(guild => {
    var configFiles = ['config', 'sheets', 'units'];

    // 폴더가 존재하지 않으면 폴더 생성
    if(fs.existsSync(`${__dirname}/config/${guild.id}`) === false) {
      fs.mkdirSync(`${__dirname}/config/${guild.id}`);

      // 설정 파일들 복사
      configFiles.map(file => {
        fs.copyFileSync(`${__dirname}/config/_${file}.json`,
          `${__dirname}/config/${guild.id}/${file}.json`
        );
      });
    }

    // 설정 파일 로드 후 변수에 저장 (123456789012345678_config 형식)
    configFiles.map(file => {
      client.config.set(`${guild.id}_${file}`, require(`./config/${guild.id}/${file}.json`));
    });
  });
}

// 명령어 파일 읽어오기
(async () => {
  for await (const file of getFiles(`${__dirname}/commands`)) {
    if(file.endsWith('.js') === false) continue;

    console.log(dateFormat(), '[INFO] 명령어 로드:', file);

    const command = require(file);
    client.commands.set(command.name, command);
  }
})();

// Discord 로그인
client.login(process.env.pm_id ? auth.token : auth.token_debug);


/* 이벤트 처리 */


client.once('ready', () => {
  console.log(dateFormat(), '[INFO] 다음 계정으로 로그인:', client.user.tag);
  console.log(dateFormat(), `[INFO] ${client.guilds.cache.size}개의 서버에서 ${client.users.cache.size}명의 멤버 확인`);

  initialConfig(client);

  client.version = `v${__BOT__VERSION__}`;
  client.updateTime = parseInt(fs.statSync(__filename).mtimeMs);
  client.user.setPresence({ activity: { name: `옴닉 ${client.version}` }, status: 'online' });
});

// 서버 가입시 처리
client.on('guildCreate', async guild => {
  client.users.cache.get(auth.owner_id).send(`${dateFormat()} [INFO] 새로운 서버가 추가됨: ${guild.name}`);
  console.log(dateFormat(), '[INFO] 새로운 서버가 추가됨:', guild.name);

  // 봇 초대 메시지를 보낼 채널을 찾음
  let welcomeChannel = guild.systemChannel;
  if(welcomeChannel == null || !welcomeChannel.permissionsFor(guild.me).has('SEND_MESSAGES'))
    welcomeChannel = null;
  guild.channels.cache.forEach(channel => {
    if(welcomeChannel == null && channel.type === 'text' && channel.permissionsFor(guild.me).has('SEND_MESSAGES')) {
      welcomeChannel = channel;
    }
  });

  // 메시지를 전송할 채널을 찾을 수 없으면 서버 나가기
  if(welcomeChannel == null) {
    guild.leave()
      .then(g => client.users.cache.get(auth.owner_id).send(`${dateFormat()} [ ERR] 메시지 채널을 찾을 수 없음: ${g.name}`))
      .catch(`${dateFormat()} [ ERR] ${console.error}`);

    return;
  }

  welcomeChannel.send(
    '미스티, 시어리, 트루리! 매지컬 리본, 스파이럴!\n' +
    '마법 탐정 미스티★카스미, 마법의 힘으로 수사 개시!\n' +
    '초기 설정을 하는 중이니까 잠시만 기다려주게나! 조수 군!'
  );

  // 설정 파일 복사
  const message = await welcomeChannel.send('설정 파일 복사 중이라네... (1/4)');
  initialConfig(client);

  // 서버 주인을 봇 관리자로 설정
  await message.edit('서버 주인을 봇 관리자로 설정 중이라네... (2/4)');
  const config = client.config.get(`${guild.id}_config`);
  config.admin_user_ids.push(guild.owner.id);

  // 동작할 채널 설정
  await message.edit('동작 채널 설정 중이라네... (3/4)');
  config.action_channel_ids.push(welcomeChannel.id);

  // 변경된 정보 설정 파일에 저장
  await message.edit('설정 저장 중이라네... (4/4)');
  global.fn.saveConfig(`${__dirname}/config/${guild.id}/config.json`, config);

  message.edit(
    '초기 설정을 완료했다네, 조수 군!\n' +
    '예약이나 시트 관련 명령어를 사용하려면 각 멤버마다 별명을 등록해야 한다네!\n' +
    '자세한 설명은 `!도움말` 또는 `!설명서` 를 참고해주게나!'
  );
});

// 메시지 처리
client.on('message', async message => {
  // DM 메시지, 봇의 메시지 무시
  if(message.channel.type === 'dm' || message.author.bot) return;

  const config = client.config.get(`${message.guild.id}_config`);
  const startTime = Date.now();
  ++config.chat_count;

  // 명령어가 아니면 무시
  if(!message.content.startsWith(config.prefix)) return;

  // // DM 메시지라면 최고 관리자만 허용
  // if(message.channel.type === 'dm' && auth.owner_id !== message.author.id) return;

  // 명령어 매개 변수 설정
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName)
    || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

  // 존재하지 않는 명령어면 무시
  if(!command) return;

  // 매개 변수가 입력되지 않았을 경우 처리
  if((command.hasArgument && (!command.hideCommand) && !args.length)) {
    let text = '오류: 이 명령어는 매개 변수가 필요해, 조수 군!';

    if(command.usages)
      text +=
        '\n```css\n' +
        command.usages.map(value => `${config.prefix}${command.name} ${value}`).join('\n')
        + '```';

    return message.channel.send(text);
  }

  // 명령어 실행 권한 관리
  const flags = parseInt(command.privileges || 1111, 2); // 명령어 권한
  let privileges = 1; // 사용자 권한
  privileges += message.author.id === auth.owner_id ? 8 : 0;
  privileges += config.admin_user_ids.includes(message.author.id) ? 4 : 0;
  privileges += message.member.roles.cache
    .some(role => config.action_roles_ids.includes(role.id)) === true ? 2 : 0;

  // 클랜원만 실행 가능한 명령어인지 확인
  if((flags & privileges) === 0 && (flags & 2) > 1)
    return message.channel.send('조수 군! 자네는 명령어를 실행할 권한이 없다네. (클랜원 이상)');

  // 관리자만 실행 가능한 명령어인지 확인
  if((flags & privileges) === 0 && (flags & 4) > 1)
    return message.channel.send('조수 군! 자네는 명령어를 실행할 권한이 없다네. (운영진 이상)');

  // 개발자만 실행 가능한 명령어인지 확인
  if((flags & privileges) === 0 && (flags & 8) > 1)
    return; // 무응답
    // return message.channel.send('조수 군! 자네는 명령어를 실행할 권한이 없다네. (개발자 전용)');

  // 명령어를 사용할 수 있는 채널인지 확인
  if(message.author.id !== auth.owner_id && message.channel.type === 'text' &&
    config.action_channel_ids.includes(message.channel.id) === false)
    return; // 무응답
    // return message.channel.send('조수 군! 이 채널에서는 명령어를 사용할 수 없다네.');

  // 명령어가 이미 실행중이면 알려줌
  // if(global.runCommand !== null)
  //   return message.channel
  //     .send(`조수 군! 다른 명령어가 실행중이니 기다려주게나. (\`${config.prefix}${global.runCommand}\`)`)
  //     .then(msg => msg.delete({timeout: 10000}))
  //     .catch();

  // 쿨타임 처리
  if(!cooltimes.has(command.name)) cooltimes.set(command.name, new Discord.Collection());

  const currentTime = Date.now();
  const timestamps = cooltimes.get(command.name);
  const cooltimeValue = (command.cooltime || 1) * 1000;

  if(timestamps.has(message.author.id)) {
    const expireTime = timestamps.get(message.author.id) + cooltimeValue;

    if(currentTime < expireTime) {
      const timeLeft = (expireTime - currentTime) / 1000;
      return message.channel.send(`조수 군! 이 명령어는 ${timeLeft.toFixed(1)}초 뒤에 실행 가능하다네.`);
    }
  }

  timestamps.set(message.author.id, currentTime);
  setTimeout(() => timestamps.delete(message.author.id), cooltimeValue);


  try {
    // global.runCommand = commandName;
    new Error(command.execute(message, args)); // @TODO DEBUG ONLY
    ++config.command_count;
  } catch(error) {
    message.channel.send(`조수 군, 명령어를 실행하는 중에 오류가 발생한 것 같다네...\n\`\`\`${error}\`\`\``);
    client.users.cache.get(auth.owner_id).send(`${dateFormat()} [ ERR] ${error}\n\`\`\`${error.stack}\`\`\``);
    console.error(`${dateFormat()} [ ERR] ${error}`);
  } finally {
    // global.runCommand = null;
    console.log(`${dateFormat()} [CHAT] [${+new Date-startTime}ms] [${message.author.id}] ${message.content}`);
  }
});

// client.on('debug', info => console.debug(dateFormat(), '[DEBG]', info));
client.on('warn', info => console.warn(dateFormat(), '[WARN]', info));
client.on('error', error => {
  client.users.cache.get(auth.owner_id).send(`${dateFormat()} [cERR] ${error}\n\`\`\`${error.stack}\`\`\``);
  console.error(dateFormat(), '[cERR]', error);
});
client.on('shardError', error => {
  console.error(dateFormat(), '[sERR]', error);
});
process.on('unhandledRejection', error => {
  client.users.cache.get(auth.owner_id).send(`${dateFormat()} [pERR] ${error}\n\`\`\`${error.stack}\`\`\``);
  console.error(dateFormat(), '[pERR]', error);
});
