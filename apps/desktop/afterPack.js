/**
 * afterPack hook — signAndEditExecutable: false olduğunda
 * rcedit ile exe'ye AlbaChat.ico ikonunu gömer.
 */
const path = require('path');
const rcedit = require('rcedit');

exports.default = async function afterPack(context) {
  const exePath = path.join(context.appOutDir, 'AlbaChat.exe');
  const icoPath = path.join(__dirname, 'assets', 'AlbaChat.ico');
  console.log(`  • afterPack: embedding icon → ${icoPath}`);
  await rcedit(exePath, { icon: icoPath });
  console.log('  • afterPack: icon embedded successfully');
};
