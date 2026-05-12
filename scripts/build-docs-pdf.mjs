import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import MarkdownIt from 'markdown-it';
import puppeteer from 'puppeteer';

const projectRoot = process.cwd();
const docsDir = path.join(projectRoot, 'docs');
const inputMd = path.join(docsDir, 'documentacio.md');
const cssPath = path.join(docsDir, 'style.css');
const outPdf = path.join(docsDir, 'Documentacio-AEA2.pdf');

if (!fs.existsSync(inputMd)) {
  console.error(`Missing ${inputMd}`);
  process.exit(1);
}

const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const mdText = fs.readFileSync(inputMd, 'utf8');
const rendered = md.render(mdText);
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

const html = `<!doctype html>
<html lang="ca">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Documentació AEA2</title>
    <style>${css}</style>
  </head>
  <body>
    ${rendered}
  </body>
</html>`;

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.emulateMediaType('screen');
  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
  });
  console.log(`OK: ${outPdf}`);
} finally {
  await browser.close();
}

