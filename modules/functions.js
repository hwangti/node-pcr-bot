module.exports.numberFormat = number => {
  return (number || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
  let string = '';
  string += (displayName !== primary) ? `${displayName}(${primary})` : displayName;
  string += '';

  return string;
}

// function getDecoratedName(displayName, primary) {
//   let string = '**`';
//   string += (displayName !== primary) ? `${displayName}(${primary})` : displayName;
//   string += '`**';

//   return string;
// }
