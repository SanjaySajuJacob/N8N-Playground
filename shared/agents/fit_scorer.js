const { callLLM } = require('../llm_client');

/**
 * Scores a base resume against a parsed job description.
 * @param {string} baseResume - The text of the base resume.
 * @param {Object} parsedJD - The parsed job description object.
 * @returns {Promise<Object>} - Score and reasoning.
 */
async function scoreFit(baseResume, parsedJD) {
    const prompt = `
You are an expert recruiter. Compare the candidate's resume to the job description requirements.
Score the fit on a scale of 0 to 100.
Provide a short reasoning (max 2 sentences) and the integer score.
Respond ONLY with valid JSON containing "score" (integer) and "reasoning" (string).

Job Requirements:
${JSON.stringify(parsedJD, null, 2)}

Candidate Resume:
"""
${baseResume}
"""
    `;

    const messages = [
        { role: 'system', content: 'You are a helpful AI that outputs only valid JSON.' },
        { role: 'user', content: prompt }
    ];

    const response = await callLLM(messages, { 
        response_format: { type: 'json_object' }
    });

    try {
        const content = response.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error("Failed to parse fit score response as JSON:", error);
        throw error;
    }
}

module.exports = { scoreFit };
