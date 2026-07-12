const { callLLM } = require('../llm_client');

/**
 * Creates a tailored cover letter based on the optimized resume and job description.
 * @param {string} optimizedResume - The tailored resume text.
 * @param {Object} parsedJD - The parsed job description object.
 * @returns {Promise<string>} - The cover letter content.
 */
async function craftCoverLetter(optimizedResume, parsedJD) {
    const prompt = `
You are an expert career coach and copywriter. Write a compelling, highly personalized cover letter for the candidate applying to the following job.

Target Job Data:
${JSON.stringify(parsedJD, null, 2)}

Candidate Optimized Resume:
"""
${optimizedResume}
"""

Instructions:
1. Write a professional, modern cover letter that matches the requested "tone" in the job data.
2. Hook the reader in the first paragraph.
3. Highlight 2-3 specific accomplishments from the resume that prove the candidate can deliver on the job requirements.
4. Keep it under 400 words.
5. Do not hallucinate contact information; use placeholders like [Hiring Manager Name] or [Your Phone Number] if missing.
6. Return ONLY the text of the cover letter.
    `;

    const messages = [
        { role: 'system', content: 'You are an expert career coach. Output only the cover letter text.' },
        { role: 'user', content: prompt }
    ];

    const response = await callLLM(messages, { 
        temperature: 0.7 
    });

    return response.choices[0].message.content.trim();
}

module.exports = { craftCoverLetter };
