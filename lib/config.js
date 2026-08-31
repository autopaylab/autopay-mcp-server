// Points at the Online v1.1 sandbox (autopay-sandbox/) by default — the
// live, working deployment already exercised throughout this repo.
const config = {
  sandboxBase: (process.env.AUTOPAY_SANDBOX_URL || 'https://sndbx.autopaylab.com').replace(/\/$/, ''),
};

module.exports = config;
