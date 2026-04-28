import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/chat/status', (req, res) => {
    const apiKey = process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
    const prefix = apiKey ? apiKey.substring(0, 10) : "none";
    // Ensure chat stays active even if key is empty, so proxy can intercept.
    // Only hide if the key specifically matches the broken placeholder template string.
    const isActive = apiKey !== "MY_GEMINI_API_KEY";
    res.json({ active: isActive, prefix: prefix, length: apiKey.length });
  });

  app.post('/api/chat', async (req, res) => {
    try {
      let apiKey = process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      
      const ai = new GoogleGenAI({ apiKey });
      const { history, systemInstruction } = req.body;
      
      if (!history || !Array.isArray(history)) {
        return res.status(400).json({ error: 'Invalid chat history' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history,
        config: systemInstruction ? { systemInstruction } : undefined
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Chat error:', error);
      
      // Look for 503 or overload errors specifically
      let userMessage = 'Sorry, I am having trouble connecting right now.';
      if (error?.message?.includes('503') || error?.message?.includes('high demand') || error?.status === 'UNAVAILABLE') {
        userMessage = 'The AI is currently experiencing very high demand and is temporarily unavailable. Please try again in a few moments!';
      } else if (error?.status === 400 || error?.message?.includes('API key')) {
        userMessage = 'API Configuration Error: Please ensure you have a valid API Key and try again.';
      } else if (error?.message) {
         // Prevent sending ugly raw JSON stringified errors directly to UI
         try {
           const parsed = JSON.parse(error.message);
           if (parsed.error && parsed.error.message) {
               userMessage = parsed.error.message;
           }
         } catch(e) {
           userMessage = error.message;
         }
      }
      
      // Return 200 with error property so Cloud Run Proxy does not intercept 5xx and serve HTML
      res.status(200).json({ error: userMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true, 
        hmr: false // Disable HMR explicitly to prevent "WebSocket closed without opened" unhandled rejections
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
