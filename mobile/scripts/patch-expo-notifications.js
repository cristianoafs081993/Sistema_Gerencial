const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '../node_modules/expo-notifications/build/warnOfExpoGoPushUsage.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes("throw new Error(message);")) {
    content = content.replace("if (Platform.OS === 'android') {\n            throw new Error(message);\n        }\n        else ", "");
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-expo-notifications] Successfully patched warnOfExpoGoPushUsage.js');
  } else {
    console.log('[patch-expo-notifications] File already patched.');
  }
}
