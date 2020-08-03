const { google } = require('googleapis');
const { client_email, private_key } = require('../config/auth.json');

const sheets = google.sheets('v4');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function getAuthClient() {
  const client = new google.auth.JWT(client_email, null, private_key, SCOPES);

  client.authorize(error => {
    if(error) throw Error('Authentication failed.');
  });

  return client;
}

module.exports = { getAuthClient, sheets };
