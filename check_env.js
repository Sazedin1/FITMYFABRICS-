console.log(Object.keys(process.env).filter(k => k.includes('KEY') || k.includes('GEMINI') || k.includes('API') || k.includes('GENAI')));
