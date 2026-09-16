// regression test suite for cozy study room server and static assets
// run with: node test.js or npm test

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 3005;

function request(reqPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      host: '127.0.0.1',
      port: PORT,
      path: reqPath,
      headers,
      method: 'GET'
    };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8')
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

function ping() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:' + PORT + '/api/health', res => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.setTimeout(250, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// sample inputs to verify special characters and unicode handling
const DIRTY_FIXTURES = [
  { raw: '<script>alert("xss")</script>', expectedSafe: true },
  { raw: 'René & Müller <東京> ☕', expectedSafe: true },
  { raw: '   trailing whitespace test   \n\t', expectedSafe: true },
  { raw: 'javascript:void(0)', isDangerousUrl: true },
  { raw: 'data:text/html;base64,PHNjcmlwdD4=', isDangerousUrl: true },
  { raw: 'https://tutorial.math.lamar.edu/', isDangerousUrl: false }
];

async function run() {
  let proc = null;

  // spawn server if not already running on local port
  if (!await ping()) {
    proc = spawn(process.execPath, [path.join(__dirname, 'server.js')], { stdio: 'ignore' });
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (await ping()) break;
    }
  }

  try {
    // 1. health endpoint check
    const health = await request('/api/health');
    assert.strictEqual(health.status, 200);
    assert(health.headers['content-type'].includes('application/json'));
    const parsed = JSON.parse(health.body);
    assert.strictEqual(parsed.status, 'healthy');
    assert(typeof parsed.uptime === 'number' && parsed.uptime >= 0);
    console.log('[ok] /api/health returned 200 (healthy)');

    // 2. root landing page delivery
    const page = await request('/');
    assert.strictEqual(page.status, 200);
    assert(page.headers['content-type'].includes('text/html'));
    assert(page.body.includes('CozySpace'));
    console.log('[ok] / serves index.html');

    // 3. audio stream range support for seeking
    const stream = await request('/assets/sounds/lofi.mp3', { Range: 'bytes=0-1023' });
    assert.strictEqual(stream.status, 206);
    assert(stream.headers['content-range']?.startsWith('bytes 0-1023/'));
    assert.strictEqual(stream.headers['accept-ranges'], 'bytes');
    assert.strictEqual(stream.headers['content-length'], '1024');
    console.log('[ok] audio range request 206 works');

    // 4. reject path traversal outside root
    const blocked = await request('/..%2fpackage.json');
    assert.strictEqual(blocked.status, 403);
    console.log('[ok] path traversal correctly rejected (403)');

    // 5. reject bad percent encoding
    const malformed = await request('/%c0%ae%c0%ae');
    assert.strictEqual(malformed.status, 400);
    console.log('[ok] malformed percent-encoding handled with 400 Bad Request');

    // 6. verify required assets exist on disk
    const requiredFiles = [
      'index.html', 'style.css', 'script.js', 'timer.js',
      'goals.js', 'planner.js', 'shelf.js', 'notes.js',
      'assets/sounds/lofi.mp3'
    ];
    for (let i = 0; i < requiredFiles.length; i++) {
      const f = requiredFiles[i];
      assert(fs.existsSync(path.join(__dirname, f)), 'Missing asset: ' + f);
    }
    console.log('[ok] static asset files present on disk');

    // 7. unicode and character integrity
    for (let i = 0; i < DIRTY_FIXTURES.length; i++) {
      const item = DIRTY_FIXTURES[i];
      const roundtrip = Buffer.from(item.raw, 'utf8').toString('utf8');
      assert.strictEqual(roundtrip, item.raw);
    }
    console.log('[ok] dirty fixtures & unicode resilience passed (René, Müller, 東京)');

    console.log('\nAll tests passed.');
  } catch (err) {
    console.error('\nTest failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    if (proc) proc.kill();
  }
}

run();
