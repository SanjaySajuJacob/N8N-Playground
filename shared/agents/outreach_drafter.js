const { callLLM } = require('../llm_client');

/**
 * Drafts cold outreach emails or LinkedIn messages.
 * @param {string} resume - The candidate's resume.
 * @param {Object} parsedJD - The parsed job description object.
 * @returns {Promise<string>} - The drafted messages.
 */
async function draftOutreach(resume, parsedJD) {
    const prompt = `
You are an expert networker and career coach.
Based on the following Job Description and Candidate Resume, draft 2 options for a cold outreach message (one for LinkedIn, one for Email) to a Recruiter or Hiring Manager at the company.

Target Job Data:
${JSON.stringify(parsedJD, null, 2)}

Candidate Resume:
"""
${resume}
"""

Instructions:
1. LinkedIn Option: Max 300 characters, punchy, highlighting the most relevant skill match.
2. Email Option: Subject line + 3 short paragraphs. Show enthusiasm for the company, mention 1-2 key impacts from the resume, and a soft call to action.
3. Output as clean Markdown.
    `;

    const messages = [
        { role: 'system', content: 'You are an expert networker. Output markdown.' },
        { role: 'user', content: prompt }
    ];

    const response = await callLLM(messages, { temperature: 0.7 });
    return response.choices[0].message.content.trim();
}

module.exports = { draftOutreach };
