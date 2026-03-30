const fs = require('fs');

const file = 'server.js';
let content = fs.readFileSync(file, 'utf8');

// Use regex to replace parseInt(xxx) with xxx
content = content.replace(/parseInt\(([^)]+)\)/g, '$1');

fs.writeFileSync(file, content);
console.log('Successfully replaced parseInt() with string IDs for MongoDB compatibility.');
