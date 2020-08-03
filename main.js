// 인증 파일 로드
const auth = require('./config/auth.json');
global.auth = auth;

// CommonJS 모듈 로드
const fs = require('fs');

// 경로가 복잡한 모듈은 전역 변수로 지정
const dateFormat = require('./modules/dateformat');
global.dateFormat = dateFormat;
global.fn = require('./modules/functions.js');

// Discord 변수
const Discord = require('discord.js');
const client = new Discord.Client();
client.commands = new Discord.Collection();
client.config = new Discord.Collection();
const cooltimes = new Discord.Collection();


// 명령어 파일 읽어오기
const commandFiles = fs.readdirSync(`${__dirname}/commands`).filter(file => file.endsWith('.js'));
for(const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
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

// Discord 로그인
client.login(auth.token);


/* 이벤트 처리 */


client.once('ready', () => {
  initialConfig(client);

  client.version = 'v1.4.3';
  client.updateTime = parseInt(fs.statSync(__filename).mtimeMs);
  client.user.setPresence({ activity: { name: `옴닉 ${client.version}` }, status: 'online' });

  console.log(dateFormat(), '[INFO] 다음 계정으로 로그인:', client.user.tag);
  console.log(dateFormat(), `[INFO] ${client.guilds.cache.size}개의 서버에서 ${client.users.cache.size}명의 멤버 확인`);
});

// 채널 가입시 처리
client.on('guildCreate', guild => {
  initialConfig(client);

  guild.systemChannel.send('초대해 주셔서 감사합니다. `!도움말` 또는 `!설명서` 를 입력하여 사용 방법을 알아보세요.');
  client.users.cache.get(auth.owner_id).send(`${dateFormat()} [INFO] 새로운 서버가 추가됨: ${guild.name}`);
  console.log(dateFormat(), '[INFO] 새로운 서버가 추가됨:', guild.name);
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
    let text = '오류: 이 명령어는 매개 변수가 필요합니다.';

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
    return message.channel.send('오류: 명령어를 실행할 권한이 없습니다. (클랜원 이상)');

  // 관리자만 실행 가능한 명령어인지 확인
  if((flags & privileges) === 0 && (flags & 4) > 1)
    return message.channel.send('오류: 명령어를 실행할 권한이 없습니다. (운영진 이상)');

  // 개발자만 실행 가능한 명령어인지 확인
  if((flags & privileges) === 0 && (flags & 8) > 1)
    return; // 무응답
    // return message.channel.send('오류: 이 명령어는 개발자만 실행 가능합니다.');

  // 명령어를 사용할 수 있는 채널인지 확인
  if(message.author.id !== auth.owner_id && message.channel.type === 'text' &&
    config.action_channel_ids.includes(message.channel.id) === false)
    return; // 무응답
    // return message.channel.send('오류: 명령어를 사용할 수 있는 채널이 아닙니다.');

  // 명령어가 이미 실행중이면 알려줌
  // if(global.runCommand !== null)
  //   return message.channel
  //     .send(`오류: 다른 명령어가 실행 중입니다. (\`${config.prefix}${global.runCommand}\`)`)
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
      return message.channel.send(`오류: 이 명령어는 ${timeLeft.toFixed(1)}초 뒤에 실행 가능합니다.`);
    }
  }

  timestamps.set(message.author.id, currentTime);
  setTimeout(() => timestamps.delete(message.author.id), cooltimeValue);


  try {
    // global.runCommand = commandName;
    new Error(command.execute(message, args)); // @TODO DEBUG ONLY
    ++config.command_count;
  } catch(error) {
    message.channel.send(`해당 명령어를 실행하는 중에 오류가 발생했습니다.\n\`\`\`${error}\`\`\``);
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
