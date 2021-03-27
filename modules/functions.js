/* eslint-disable no-unused-vars */
module.exports.numberFormat = number => {
  return (number || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

module.exports.secondsToHuman = seconds => {
  const levels = [
    [Math.floor(seconds / 31536000), 'y'],
    [Math.floor((seconds % 31536000) / 86400), 'd'],
    [Math.floor(((seconds % 31536000) % 86400) / 3600), 'h'],
    [Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'm'],
    [(((seconds % 31536000) % 86400) % 3600) % 60, 's'],
  ];

  let returntext = '';
  for(let i=0, cnt=0, max=levels.length; i<max; i++) {
    if(levels[i][0] === 0) continue;
    returntext += levels[i][0] + levels[i][1] + ' ';
    if(++cnt >= 2) break;
  }

  return returntext.trim();
};

module.exports.sortObject = obj => {
  let keys = Object.keys(obj).sort((k1, k2) => {
    const s1 = parseInt(k1.replace('-', '0'));
    const s2 = parseInt(k2.replace('-', '0'));

    return s1 < s2 ? -1 : s1 > s2 ? 1 : 0;
  });

  let i, after = {};
  for(i=0; i<keys.length; i++) {
    after[keys[i]] = obj[keys[i]];
    delete obj[keys[i]];
  }

  for(i=0; i<keys.length; i++)
    obj[keys[i]] = after[keys[i]];

  return obj;
};

module.exports.saveConfig = (file, config) => {
  require('fs').writeFileSync(file, JSON.stringify(config, null, 2), error => {
    if(error) console.log(error);
  });
};


/* 별명 */
function verifiedName(memberId, message) {
  // undefined 발생 예외 처리
  const confirmId = message.guild.member(memberId);

  return confirmId !== null ? confirmId.displayName : `<@!${memberId}>`;
}

function printNicknames(memberId, message, linked_id, text) {
  return message.channel.send(text, new global.Discord.MessageEmbed()
    .setColor('#518FF5')
    .setTitle(`\`${verifiedName(memberId, message)}\`님의 별명 목록`)
    // .setTitle(`<@!${memberId}>님의 별명 목록`) // 안됨
    .addField('주 닉네임 (시트)', linked_id[memberId].primary)
    .addField(`별칭 (${linked_id[memberId].aliases.length})`, linked_id[memberId].aliases.join(', '))
  );
}

function getDecoratedName(displayName, primary) {
  return (displayName !== primary) ? `${displayName}(${primary})` : displayName;
}

// function getDecoratedName(displayName, primary) {
//   let string = '**`';
//   string += (displayName !== primary) ? `${displayName}(${primary})` : displayName;
//   string += '`**';

//   return string;
// }
