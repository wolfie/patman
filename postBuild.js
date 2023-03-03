const fs = require('fs');
const path = require('path');

console.log('Copying package.json');
fs.copyFileSync(
  path.resolve(__dirname, 'package.json'),
  path.resolve(__dirname, 'dist', 'package.json')
);

console.log('Copying README.md');
fs.copyFileSync(path.resolve(__dirname, 'README.md'), path.resolve(__dirname, 'dist', 'README.md'));

console.log('Reading LICENSE');
const licenseText = fs.readFileSync(path.resolve(__dirname, 'LICENSE'), 'utf-8');
console.log('Replacing YEAR and COPYRIGHT HOLDER');
const replacedLicenseText = licenseText
  .replace(/\<YEAR\>/, new Date().getFullYear())
  .replace(/\<COPYRIGHT HOLDER\>/, 'Henrik Paul');
console.log('Writing LICENSE');
fs.writeFileSync(path.resolve(__dirname, 'dist', 'LICENSE'), replacedLicenseText, 'utf-8');

console.log('Done\n');
