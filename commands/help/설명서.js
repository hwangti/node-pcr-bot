module.exports = {
  name: '설명서',
  category: 'help',
  summary: '봇 사용법이 적혀있는 구글 문서를 출력합니다.',
  aliases: ['설명서', '사용법'],
  privileges: 1111,

  async execute(message) {
    return message.channel.send(
      '설명서 구글 문서 주소:\n' +
      'https://docs.google.com/document/d/1Tbx5PpNF-8umfOWceQXciMZFX7qpaG9QDXI6_4WnVWc'
    );
  }
};
