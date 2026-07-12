const { callLLM } = require('../llm_client');

/**
 * Generates interview questions based on the job description and candidate's resume.
 * @param {string} resume - The candidate's resume.
 * @param {Object} parsedJD - The parsed job description object.
 * @returns {Promise<string>} - The interview prep notes.
 */
async function generateInterviewPrep(resume, parsedJD) {
    const prompt = `
You are an expert technical interviewer and career coach.
Based on the following Job Description and Candidate Resume, generate an interview preparation guide.

Target Job Data:
${JSON.stringify(parsedJD, null, 2)}

Candidate Resume:
"""
${resume}
"""

Instructions:
1. List 3-5 expected behavioral questions based on the company's tone and requirements, along with brief bullet points on how the candidate should answer them using the STAR method based on their resume.
2. List 3-5 technical/hard skills questions the candidate is likely to be asked.
3. Suggest 2 insightful questions the candidate should ask the interviewer.
4. Output as clean Markdown.
    `;

    const messages = [
        { role: 'system', content: 'You are an expert interview coach. Output markdown.' },
        { role: 'user', content: prompt }
    ];

    const response = await callLLM(messages, { temperature: 0.7 });
    return response.choices[0].message.content.trim();
}

module.exports = { generateInterviewPrep };
