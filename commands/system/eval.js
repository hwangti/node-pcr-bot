const { inspect } = require('util');

module.exports = {
  name: 'eval',
  category: 'system',
  summary: null,
  privileges: 1000,
  hasArgument: true,
  hideCommand: true,

  async execute(message, args) {
    const argument = args
      .join(' ')
      // .replace(/`/g, '`' + String.fromCharCode(8203))
      // .replace(/@/g, '@' + String.fromCharCode(8203))
      .trim();
    console.log(inspect(eval(argument), false, 4, true));
    message.delete().then().catch(console.error);
    // try ~ catch -> main에서 처리
  }
};
