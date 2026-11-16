const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const sass = require('sass');
const { chromium, firefox } = require('playwright');

// 원본 HTML·JS와 메모리에서 컴파일한 CSS를 제공한다. dist는 읽거나 변경하지 않는다.
async function openApp(browserName = 'chrome') {
  const root = path.resolve(__dirname, '../src');
  const css = sass.compile(path.join(root, 'scss/style.scss')).css;
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/css/style.css') {
      res.setHeader('Content-Type', 'text/css');
      return res.end(css);
    }
    const target = path.resolve(root, pathname === '/' ? 'pages/index.html' : pathname.slice(1));
    if (!target.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    try {
      const data = await fs.readFile(target);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };
      res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = browserName === 'firefox'
      ? await firefox.launch()
      : await chromium.launch({ channel: 'chrome' });
  } catch (error) {
    await new Promise(resolve => server.close(resolve));
    throw error;
  }
  return {
    browser,
    url: `http://127.0.0.1:${server.address().port}`,
    async close() {
      await browser.close();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

module.exports = { openApp };
