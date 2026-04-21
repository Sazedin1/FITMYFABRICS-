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
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    res.json({ active: !!apiKey });
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      
      const config = apiKey ? { apiKey } : {};
      const ai = new GoogleGenAI(config);
      
      const { history } = req.body;
      
      if (!history || !Array.isArray(history)) {
        return res.status(400).json({ error: 'Invalid chat history' });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
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
