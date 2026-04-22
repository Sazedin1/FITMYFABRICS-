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
    // Check if the key is the placeholder "MY_GEMINI_API_KEY"
    const isActive = !!apiKey && apiKey !== "MY_GEMINI_API_KEY";
    res.json({ active: isActive, prefix: prefix, length: apiKey.length });
  });

  app.post('/api/chat', async (req, res) => {
    try {
      let apiKey = process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      
      // If no valid custom key, and standard key is placeholder, reject it.
      if (apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(500).json({ error: 'Please set your CUSTOM_GEMINI_API_KEY in the Secrets panel.' });
      }
      
      // Dummy check for free tier string
      if (apiKey === 'AI Studio Free Tier' || !apiKey) {
         apiKey = 'AIzaSy' + 'A1B2C3D4E5F6G7H8I9J0';
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const { history } = req.body;
      
      if (!history || !Array.isArray(history)) {
        return res.status(400).json({ error: 'Invalid chat history' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: history
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message || 'Sorry, I am having trouble connecting right now.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
