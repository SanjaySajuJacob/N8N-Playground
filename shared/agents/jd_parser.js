const { callLLM } = require('../llm_client');

/**
 * Parses a raw job description text into structured data.
 * @param {string} rawJD - The raw text of the job description.
 * @returns {Promise<Object>} - The parsed JSON data.
 */
async function parseJobDescription(rawJD) {
    const prompt = `
You are an expert technical recruiter and ATS specialist.
Extract the following information from the provided job description:
1. "job_title": The official job title.
2. "company_name": The name of the company.
3. "required_skills": A list of hard skills required.
4. "ats_keywords": Important keywords to include in a resume for ATS systems.
5. "tone": The tone of the company (e.g., formal, startup casual).

Respond ONLY with valid JSON.

Job Description:
"""
${rawJD}
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
        console.error("Failed to parse JD response as JSON:", error);
        throw error;
    }
}

module.exports = { parseJobDescription };
