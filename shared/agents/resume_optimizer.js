const { callLLM } = require('../llm_client');

/**
 * Tailors a base resume to a specific job description.
 * @param {string} baseResume - The text or LaTeX code of the base resume.
 * @param {Object} parsedJD - The parsed job description object.
 * @returns {Promise<string>} - The tailored resume content.
 */
async function optimizeResume(baseResume, parsedJD) {
    const prompt = `
You are an expert resume writer. Your goal is to optimize the candidate's resume for Applicant Tracking Systems (ATS) based on a target job description, WITHOUT hallucinating or inventing new experience.

Target Job Data:
${JSON.stringify(parsedJD, null, 2)}

Candidate Base Resume:
"""
${baseResume}
"""

Instructions:
1. Re-write bullet points to better highlight the candidate's experience that aligns with the target job's required skills.
2. Integrate the ATS keywords naturally into the experience section.
3. Keep the exact same format (e.g., if it's LaTeX, return valid LaTeX. If markdown, return markdown).
4. Do NOT make up any skills or jobs the candidate does not have. Only reframe existing experience.
5. Return ONLY the final optimized resume text/code. No markdown code block wrappers (like \`\`\`latex) unless the original had them.
    `;

    const messages = [
        { role: 'system', content: 'You are an expert resume writer. Do not wrap output in markdown blocks unless requested.' },
        { role: 'user', content: prompt }
    ];

    const response = await callLLM(messages, { 
        temperature: 0.4 // lower temperature for more faithful adherence to the original facts
    });

    return response.choices[0].message.content.trim();
}

module.exports = { optimizeResume };
