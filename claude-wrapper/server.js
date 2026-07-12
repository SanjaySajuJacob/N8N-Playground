// Claude CLI HTTP wrapper for n8n.
// POST /generate {"prompt": "..."} -> {"output": "..."}
// Runs on the host; n8n (Docker) reaches it via http://host.docker.internal:3010

const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3010;
const MODEL = process.env.CLAUDE_MODEL || 'sonnet';

// Keeps the CLI from replying with agent-style commentary instead of raw content.
const SYSTEM_PROMPT =
  'You are a text-generation engine inside an automated pipeline. ' +
  'Follow the output format requested in the prompt exactly. ' +
  'Output only the requested content - no commentary, no preamble, no explanations of what you did.';

// Shared secret: only callers that know the token (the n8n workflow) are served.
// Auto-generated on first run, stored next to this file.
const TOKEN_FILE = path.join(__dirname, '.token');
function loadToken() {
  if (process.env.WRAPPER_TOKEN) return process.env.WRAPPER_TOKEN;
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  const t = require('crypto').randomBytes(32).toString('hex');
  fs.writeFileSync(TOKEN_FILE, t);
  return t;
}
const TOKEN = loadToken();

function findClaudeBin() {
  // 1. On PATH (global install)
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const name of ['claude.exe', 'claude.cmd', 'claude']) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  // 2. Bundled with the VS Code extension (pick highest version)
  const extRoot = path.join(os.homedir(), '.vscode', 'extensions');
  if (fs.existsSync(extRoot)) {
    const candidates = fs.readdirSync(extRoot)
      .filter((d) => d.startsWith('anthropic.claude-code-'))
      .sort()
      .reverse();
    for (const d of candidates) {
      const p = path.join(extRoot, d, 'resources', 'native-binary', 'claude.exe');
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('claude CLI not found (PATH or VS Code extension)');
}

const CLAUDE_BIN = findClaudeBin();
console.log(`claude binary: ${CLAUDE_BIN}`);

function runClaude(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--append-system-prompt', SYSTEM_PROMPT];
    if (MODEL) args.push('--model', MODEL);

    // cwd = wrapper dir so no project CLAUDE.md/skills leak into the prompt
    const child = spawn(CLAUDE_BIN, args, { cwd: __dirname });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.is_error) return reject(new Error(`claude error: ${parsed.result}`));
        resolve(parsed.result);
      } catch (e) {
        reject(new Error(`bad CLI output: ${stdout.slice(0, 500)}`));
      }
    });

    // Prompt via stdin — avoids Windows command-line length limits
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// Slice a complete LaTeX document out of model output; null if none present.
// Strips markdown fences, prose prefixes/suffixes, any chat commentary.
function extractLatex(s) {
  const start = s.indexOf('\\documentclass');
  const endTag = '\\end{document}';
  const end = s.lastIndexOf(endTag);
  if (start === -1 || end === -1 || end < start) return null;
  return s.slice(start, end + endTag.length);
}

const server = http.createServer((req, res) => {
  if (req.headers['x-wrapper-token'] !== TOKEN) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'unauthorized' }));
  }
  if (req.method !== 'POST' || req.url !== '/generate') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'POST /generate only' }));
  }

  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', async () => {
    let prompt, format;
    try {
      const parsed = JSON.parse(body);
      prompt = parsed.prompt;
      format = parsed.format; // "latex" enables extraction + one corrective retry
      if (!prompt) throw new Error('missing prompt');
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }

    const started = Date.now();
    console.log(`[${new Date().toISOString()}] prompt received (${prompt.length} chars, format=${format || 'text'})`);
    try {
      let output = await runClaude(prompt);

      if (format === 'latex') {
        let latex = extractLatex(output);
        if (latex === null) {
          console.warn('  output was not LaTeX, retrying with corrective prompt');
          output = await runClaude(
            prompt +
              '\n\nIMPORTANT: Your previous reply was not raw LaTeX. Respond with ONLY the complete ' +
              'LaTeX source: first line must start with \\documentclass, last line must be \\end{document}. ' +
              'No other text of any kind.'
          );
          latex = extractLatex(output);
        }
        if (latex === null) throw new Error('model did not return a complete LaTeX document');
        output = latex;
      }

      console.log(`  done in ${((Date.now() - started) / 1000).toFixed(1)}s (${output.length} chars)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ output }));
    } catch (e) {
      console.error(`  failed: ${e.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.setTimeout(0); // LaTeX rewrites can run minutes
server.listen(PORT, () => console.log(`claude-wrapper listening on :${PORT}`));
