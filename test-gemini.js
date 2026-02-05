require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    try {
        console.log('Testing gemini-2.0-flash...');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = "Hello, are you working?";
        const result = await model.generateContent(prompt);
        const response = result.response.text();

        console.log('Response:', response);
    } catch (error) {
        console.error('Error:', error);
    }
}

testGemini();
