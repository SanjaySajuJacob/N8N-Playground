/**
 * A generic function to call an LLM endpoint.
 * Requires LLM_ENDPOINT and LLM_SECRET to be set in the environment.
 * 
 * @param {Array} messages - The conversational messages (e.g., [{role: "user", content: "hello"}])
 * @param {Object} options - Additional options like temperature, model name, etc.
 * @returns {Promise<Object>} - The JSON response from the LLM endpoint
 */
async function callLLM(messages, options = {}) {
    const endpoint = process.env.LLM_ENDPOINT;
    const secret = process.env.LLM_SECRET;

    if (!endpoint || !secret) {
        throw new Error("LLM_ENDPOINT or LLM_SECRET is not defined in the environment.");
    }

    // Default to OpenAI format, but this can be adapted for others
    const body = {
        model: options.model || 'gpt-4o-mini',
        messages: messages,
        temperature: options.temperature || 0.7,
        ...options
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${secret}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`LLM API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Failed to call LLM:", error);
        throw error;
    }
}

module.exports = { callLLM };
