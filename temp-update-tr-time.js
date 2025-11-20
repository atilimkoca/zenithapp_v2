const fs = require('fs');
const path = 'src/locales/tr.js';
let content = fs.readFileSync(path, 'utf8');
const oldBlock =   // Time and Date\\n  time: {\\n    hours: 'saat',\\n    minutes: 'dakika',\\n    hoursLeft: 'saat kaldı',\\n    ago: 'önce',\\n    now: 'şimdi',\\n    today: 'bugün',\\n    yesterday: 'dün',\\n    tomorrow: 'yarın',\\n    date: 'Tarih',\\n    time: 'Saat',\\n  },\\n;
const newBlock =   // Time and Date\\n  time: {\\n    hours: 'saat',\\n    minutes: 'dakika',\\n    hoursLeft: 'saat kaldı',\\n    ago: 'önce',\\n    now: 'şimdi',\\n    today: 'Bugün',\\n    yesterday: 'Dün',\\n    tomorrow: 'Yarın',\\n    date: 'Tarih',\\n    time: 'Saat',\\n    dateNotSpecified: 'Tarih belirtilmedi',\\n    invalidDate: 'Geçersiz tarih',\\n    dateError: 'Tarih hatası',\\n  },\\n;
if (!content.includes(oldBlock)) {
  throw new Error('Time block not found in tr.js');
}
content = content.replace(oldBlock, newBlock);
fs.writeFileSync(path, content, 'utf8');
