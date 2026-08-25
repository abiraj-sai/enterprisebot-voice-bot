const jwt = require("jsonwebtoken");

function createAuthToken(account) {
  return jwt.sign(
    {
      userId: account.id,
      accountNumber: account.account_number
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "10m"
    }
  );
}

function verifyAuthToken(token) {
  return jwt.verify(
    token,
    process.env.JWT_SECRET
  );
}

module.exports = {
  createAuthToken,
  verifyAuthToken
};