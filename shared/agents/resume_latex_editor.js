const { callLLM } = require('../llm_client');

/**
 * Applies a list of tagged improvement instructions directly to a LaTeX resume source.
 * @param {string} latexSource - Raw .tex file content.
 * @param {string} improvements - Tagged improvement list from AI Agent1 (e.g. "[ADD] ...\n[REWRITE] ...").
 * @param {string} [jobTitle] - Optional: job title for context.
 * @param {string} [company] - Optional: company name for context.
 * @returns {Promise<string>} - Modified, compilable LaTeX source.
 */
async function applyLatexImprovements(latexSource, improvements, jobTitle = '', company = '') {
    const prompt = `
You are an expert LaTeX resume editor. Apply the improvement instructions below to the LaTeX resume source code.

Target Role: ${jobTitle} at ${company}

STRICT RULES:
1. Preserve ALL LaTeX commands, packages, \\begin/\\end blocks, and document structure exactly.
2. Only modify text content inside LaTeX commands (e.g., inside \\item{}, \\textbf{}, etc.).
3. [ADD] → Insert the described content in the most appropriate section.
4. [REMOVE] → Delete the described content entirely.
5. [REWRITE] → Rewrite the specified bullet/sentence to better match the job.
6. [KEYWORDS] → Weave the listed keywords naturally into existing bullets.
7. [QUANTIFY] → Add plausible metrics to existing bullets (do NOT invent new facts; only quantify existing ones).
8. [ORDER] → Reorder sections or bullets as described.
9. [FORMAT] → Adjust formatting as described.
10. [FOCUS] → Emphasize the described aspect by strengthening related bullets.
11. Do NOT hallucinate new jobs, companies, or skills not already in the resume.
12. Return ONLY the complete LaTeX source code. No markdown fences, no commentary.

Base LaTeX Resume:
"""
${latexSource}
"""

Improvement Instructions to Apply:
"""
${improvements}
"""
    `;

    const messages = [
        { role: 'system', content: 'You are an expert LaTeX resume editor. Return only valid, compilable LaTeX source code. No markdown. No commentary.' },
        { role: 'user', content: prompt }
    ];

    const response = await callLLM(messages, {
        temperature: 0.3 // low temp = faithful to original structure
    });

    let result = response.choices[0].message.content.trim();

    // Strip any accidental markdown code fences the LLM might add
    result = result.replace(/^```(?:latex|tex)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    return result;
}

module.exports = { applyLatexImprovements };
