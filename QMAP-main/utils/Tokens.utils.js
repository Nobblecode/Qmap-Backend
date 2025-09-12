const randtoken = require("rand-token").generator();

function GenOTP() {
  return randtoken.generate(4, "0123456789");
}

module.exports = { GenOTP };
