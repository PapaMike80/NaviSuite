const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

// 1. Verify doc-viewer.js syntax
assert.doesNotThrow(() => {
  execFileSync(process.execPath, ['--check', 'assets/js/doc-viewer.js'], { stdio: 'pipe' });
}, 'assets/js/doc-viewer.js syntax check failed');

const docViewerCode = fs.readFileSync('assets/js/doc-viewer.js', 'utf8');

// 2. Check essential viewer components & autohide support
assert.match(docViewerCode, /id="naviDocCloseBtn"/, 'Missing close button in doc-viewer.js');
assert.match(docViewerCode, /id="naviDocMenuBtn"/, 'Missing menu button in doc-viewer.js');
assert.match(docViewerCode, /window\.NaviDocViewer\s*=/, 'Missing NaviDocViewer export in doc-viewer.js');
assert.match(docViewerCode, /window\.NaviSuiteMenu\.open/, 'Missing NaviSuiteMenu open trigger in doc-viewer.js');
assert.match(docViewerCode, /body\.navi-doc-open/, 'Missing body scroll lock CSS in doc-viewer.js');
assert.match(docViewerCode, /setToolbarHidden/, 'Missing setToolbarHidden function in doc-viewer.js');
assert.match(docViewerCode, /navi-doc-toolbar-hidden/, 'Missing navi-doc-toolbar-hidden class in doc-viewer.js');

// 3. Verify concorso-controllo.html
const controlloHtml = fs.readFileSync('concorso-controllo.html', 'utf8');
assert.match(controlloHtml, /assets\/js\/shared-roles\.js/, 'shared-roles missing in concorso-controllo.html');
assert.match(controlloHtml, /assets\/js\/shared-menu\.js/, 'shared-menu missing in concorso-controllo.html');
assert.match(controlloHtml, /assets\/js\/doc-viewer\.js/, 'doc-viewer missing in concorso-controllo.html');
assert.match(controlloHtml, /navisuite-header-menu/, 'navisuite-header-menu button missing in concorso-controllo.html');

// 4. Verify concorso-naviganti.html
const navigantiHtml = fs.readFileSync('concorso-naviganti.html', 'utf8');
assert.match(navigantiHtml, /assets\/js\/doc-viewer\.js/, 'doc-viewer missing in concorso-naviganti.html');
assert.match(navigantiHtml, /navisuite-header-menu/, 'navisuite-header-menu button missing in concorso-naviganti.html');

// 5. Verify documenti.html
const documentiHtml = fs.readFileSync('documenti.html', 'utf8');
assert.match(documentiHtml, /id="viewerMenu"/, 'viewerMenu button missing in documenti.html');
assert.match(documentiHtml, /window\.NaviSuiteMenu\?\.open/, 'viewerMenu onclick missing in documenti.html');

// 6. Verify shared-menu.js loads doc-viewer.js automatically
const sharedMenuCode = fs.readFileSync('assets/js/shared-menu.js', 'utf8');
assert.match(sharedMenuCode, /doc-viewer\.js/, 'shared-menu.js must auto-inject doc-viewer.js');

// 7. Verify sw.js includes doc-viewer.js and new cache version
const swCode = fs.readFileSync('sw.js', 'utf8');
assert.match(swCode, /navisuite-v749-doc-viewer-autohide/, 'sw.js cache version must be bumped');
assert.match(swCode, /'\.\/assets\/js\/doc-viewer\.js'/, 'sw.js must cache doc-viewer.js');

// 8. Verify dispense do not have the redundant top-bar section
const dispensa01 = fs.readFileSync('docs/controllo/dispense_navisuite/01_Ordinamento_GGNL_Legge_614.html', 'utf8');
assert.doesNotMatch(dispensa01, /<nav class="top-bar">/, 'Dispensa 01 must not have redundant top-bar');

console.log('Doc viewer tests passed successfully');
