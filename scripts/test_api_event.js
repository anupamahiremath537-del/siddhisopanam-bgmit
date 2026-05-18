const http = require('http');

const eventId = '3eb8ffc3-7b8f-4e07-a9b3-f63004b8c279';
const options = {
  hostname: 'localhost',
  port: 3001,
  path: `/api/events/${eventId}`,
  method: 'GET'
};

console.log(`Testing API: http://localhost:3001/api/events/${eventId}`);

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('BODY:', body);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
