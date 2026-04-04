const functions = require('firebase-functions');
const server = require('../server'); // Import from root server.js

// Re-export the functions from server.js
exports.api = server.api;
exports.scheduledReminders = server.scheduledReminders;
exports.scheduledDailyReport = server.scheduledDailyReport;
