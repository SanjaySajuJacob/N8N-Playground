const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

/**
 * POST /compile
 * Body: { "source": "<LaTeX source code>", "compiler": "pdflatex" (optional) }
 * Returns: PDF binary (application/pdf) or JSON error
 */
app.post('/compile', (req, res) => {
  const { source, compiler = 'pdflatex' } = req.body;

  if (!source || typeof source !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "source" field.' });
  }

  // Whitelist compilers
  const allowed = ['pdflatex', 'xelatex', 'lualatex'];
  if (!allowed.includes(compiler)) {
    return res.status(400).json({ error: `Compiler must be one of: ${allowed.join(', ')}` });
  }

  // Unique temp dir per request
  const id = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(os.tmpdir(), `latex-${id}`);
  const texFile = path.join(tmpDir, 'resume.tex');
  const pdfFile = path.join(tmpDir, 'resume.pdf');

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(texFile, source, 'utf8');

    // Two-pass compile for proper references/TOC.
    // pdflatex exits non-zero on warnings (rerunfilecheck, fancyhdr, etc.) even
    // when the PDF is successfully written, so we ignore the exit code and check
    // for the output file instead.
    const cmd = `${compiler} -interaction=nonstopmode -output-directory=${tmpDir} ${texFile}`;
    let compileErr = null;
    try { execSync(cmd, { timeout: 60000, stdio: 'pipe' }); } catch (e) { compileErr = e; }
    try { execSync(cmd, { timeout: 60000, stdio: 'pipe' }); } catch (e) { compileErr = e; }

    if (!fs.existsSync(pdfFile)) {
      const logFile = path.join(tmpDir, 'resume.log');
      let log = '';
      try { log = fs.readFileSync(logFile, 'utf8').slice(-3000); } catch (_) {}
      return res.status(500).json({
        error: 'PDF not generated. Check LaTeX source.',
        details: compileErr?.message ?? '',
        log_tail: log,
      });
    }

    const pdf = fs.readFileSync(pdfFile);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="resume.pdf"');
    res.send(pdf);

  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error.', details: err.message });
  } finally {
    // Cleanup temp dir
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`latex-compiler listening on :${PORT}`));
