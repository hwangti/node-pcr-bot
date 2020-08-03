/* eslint-disable no-irregular-whitespace */
module.exports = {
  name: '채널정보',
  summary: '채널 정보와 생성된 시간을 표시합니다.',
  privileges: 1100,

  async execute(message) {
    const getSnowflake = string => global.dateFormat(parseInt(string) / 4194304 + 1420070400000);

    message.channel.send(
      (message.channel.type === 'text' ?
        `카테고리: ${message.channel.parent.id} (${getSnowflake(message.channel.parent.id)})\n` : '') +
      `　　채널: ${message.channel.id} (${getSnowflake(message.channel.id)})`
      ,
      { code: 'yaml'}
    );
  }
};
