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

  // Helper for Client IP Detection
  function getClientIp(req: express.Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const list = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
      const first = list[0]?.trim();
      if (first) return first.replace(/^::ffff:/, '');
    }
    const realIp = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'];
    if (realIp && typeof realIp === 'string') {
      return realIp.replace(/^::ffff:/, '');
    }
    const remote = req.socket.remoteAddress || '';
    return remote.replace(/^::ffff:/, '') || '127.0.0.1';
  }

  // Helper for Device Model, OS, Browser parsing
  function parseDeviceDetails(uaString: string, clientHints: any = {}) {
    const ua = uaString || '';
    let os = 'Unknown OS';
    let browser = 'Unknown Browser';
    let deviceModel = 'Desktop / PC';
    let deviceType = 'Desktop';

    // Device Model & OS Detection
    if (/iPhone/i.test(ua)) {
      deviceType = 'Mobile';
      os = 'iOS';
      const verMatch = ua.match(/OS (\d+[_\.]\d+)/i);
      if (verMatch) os = `iOS ${verMatch[1].replace(/_/g, '.')}`;
      
      if (clientHints && clientHints.screen) {
        const { width, height } = clientHints.screen;
        const h = Math.max(width || 0, height || 0);
        const w = Math.min(width || 0, height || 0);
        if (h >= 932 && w >= 430) deviceModel = 'iPhone 15/16 Pro Max / Plus';
        else if (h >= 852 && w >= 393) deviceModel = 'iPhone 15/16 Pro / 15 / 14 Pro';
        else if (h >= 844 && w >= 390) deviceModel = 'iPhone 14 / 13 / 12';
        else if (h >= 926 && w >= 428) deviceModel = 'iPhone 14 Plus / 13 Pro Max';
        else if (h >= 812 && w >= 375) deviceModel = 'iPhone 13 Mini / 12 Mini / X';
        else if (h >= 896 && w >= 414) deviceModel = 'iPhone 11 / XR / XS Max';
        else deviceModel = 'Apple iPhone';
      } else {
        deviceModel = 'Apple iPhone';
      }
    } else if (/iPad/i.test(ua)) {
      deviceType = 'Tablet';
      os = 'iPadOS';
      deviceModel = 'Apple iPad';
    } else if (/Android/i.test(ua)) {
      deviceType = /Mobile/i.test(ua) ? 'Mobile' : 'Tablet';
      const andVer = ua.match(/Android (\d+(\.\d+)?)/i);
      os = andVer ? `Android ${andVer[1]}` : 'Android';

      if (/SM-[A-Z0-9]+/i.test(ua)) {
        const smMatch = ua.match(/SM-([A-Z0-9]+)/i);
        deviceModel = smMatch ? `Samsung Galaxy (SM-${smMatch[1]})` : 'Samsung Galaxy';
      } else if (/Redmi/i.test(ua)) {
        const m = ua.match(/Redmi[^;\)]*/i);
        deviceModel = m ? m[0] : 'Xiaomi Redmi';
      } else if (/POCO/i.test(ua)) {
        const m = ua.match(/POCO[^;\)]*/i);
        deviceModel = m ? m[0] : 'Xiaomi POCO';
      } else if (/Pixel/i.test(ua)) {
        const m = ua.match(/Pixel[^;\)]*/i);
        deviceModel = m ? m[0] : 'Google Pixel';
      } else if (/OnePlus|ONEPLUS/i.test(ua)) {
        const m = ua.match(/ONEPLUS[^;\)]*/i) || ua.match(/OnePlus[^;\)]*/i);
        deviceModel = m ? m[0] : 'OnePlus';
      } else if (/Vivo|vivo/i.test(ua)) {
        deviceModel = 'Vivo Smartphone';
      } else if (/Oppo|OPPO/i.test(ua)) {
        deviceModel = 'Oppo Smartphone';
      } else if (/Realme|RMX[0-9]+/i.test(ua)) {
        deviceModel = 'Realme Smartphone';
      } else if (/Infinix/i.test(ua)) {
        deviceModel = 'Infinix Smartphone';
      } else if (/Tecno/i.test(ua)) {
        deviceModel = 'Tecno Smartphone';
      } else {
        const buildMatch = ua.match(/;\s*([A-Za-z0-9\s_\-]+)\s+Build\//i);
        deviceModel = buildMatch ? buildMatch[1].trim() : 'Android Device';
      }
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      deviceType = 'Desktop';
      os = 'macOS';
      const macVer = ua.match(/Mac OS X (\d+[_\.]\d+([_\.]\d+)?)/i);
      if (macVer) os = `macOS ${macVer[1].replace(/_/g, '.')}`;
      deviceModel = 'Apple Mac / MacBook';
    } else if (/Windows/i.test(ua)) {
      deviceType = 'Desktop';
      if (/Windows NT 10.0/i.test(ua)) os = 'Windows 11 / 10';
      else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
      else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
      else os = 'Windows';
      deviceModel = 'Windows PC / Laptop';
    } else if (/Linux/i.test(ua)) {
      deviceType = 'Desktop';
      os = 'Linux';
      deviceModel = 'Linux Desktop';
    } else if (/CrOS/i.test(ua)) {
      deviceType = 'Laptop';
      os = 'Chrome OS';
      deviceModel = 'Chromebook';
    }

    // Browser detection
    if (/Edg\//i.test(ua)) {
      const v = ua.match(/Edg\/(\d+(\.\d+)?)/i);
      browser = v ? `Microsoft Edge ${v[1]}` : 'Microsoft Edge';
    } else if (/SamsungBrowser/i.test(ua)) {
      const v = ua.match(/SamsungBrowser\/(\d+(\.\d+)?)/i);
      browser = v ? `Samsung Internet ${v[1]}` : 'Samsung Internet';
    } else if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) {
      const v = ua.match(/(?:Chrome|CriOS)\/(\d+(\.\d+)?)/i);
      browser = v ? `Google Chrome ${v[1]}` : 'Google Chrome';
    } else if (/Firefox|FxiOS/i.test(ua)) {
      const v = ua.match(/(?:Firefox|FxiOS)\/(\d+(\.\d+)?)/i);
      browser = v ? `Mozilla Firefox ${v[1]}` : 'Mozilla Firefox';
    } else if (/Safari/i.test(ua) && !/Chrome|CriOS|Android/i.test(ua)) {
      const v = ua.match(/Version\/(\d+(\.\d+)?)/i);
      browser = v ? `Apple Safari ${v[1]}` : 'Apple Safari';
    } else if (/Opera|OPR/i.test(ua)) {
      const v = ua.match(/(?:Opera|OPR)\/(\d+(\.\d+)?)/i);
      browser = v ? `Opera ${v[1]}` : 'Opera';
    }

    return { os, browser, deviceModel, deviceType };
  }

  // Geolocation Resolver
  async function resolveGeo(ip: string) {
    const isPrivate = !ip || ip === '127.0.0.1' || ip === 'localhost' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.');
    
    let targetIp = ip;
    if (isPrivate) {
      try {
        const pubRes = await fetch('https://api64.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
        if (pubRes.ok) {
          const pubData: any = await pubRes.json();
          if (pubData.ip) targetIp = pubData.ip;
        }
      } catch (e) {}
    }

    try {
      const res = await fetch(`http://ip-api.com/json/${targetIp}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,query`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.status === 'success') {
          return {
            ip: data.query || targetIp || ip,
            city: data.city || 'Dhaka',
            region: data.regionName || 'Dhaka Division',
            country: data.country || 'Bangladesh',
            countryCode: data.countryCode || 'BD',
            timezone: data.timezone || 'Asia/Dhaka',
            isp: data.isp || data.org || 'Internet Provider',
            lat: data.lat,
            lon: data.lon,
            locationString: `${data.city || 'Dhaka'}, ${data.country || 'Bangladesh'}`
          };
        }
      }
    } catch (e) {}

    try {
      const res2 = await fetch(`https://ipwho.is/${targetIp}`, { signal: AbortSignal.timeout(3000) });
      if (res2.ok) {
        const data2: any = await res2.json();
        if (data2.success !== false) {
          return {
            ip: data2.ip || targetIp || ip,
            city: data2.city || 'Dhaka',
            region: data2.region || 'Dhaka Division',
            country: data2.country || 'Bangladesh',
            countryCode: data2.country_code || 'BD',
            timezone: data2.timezone?.id || 'Asia/Dhaka',
            isp: data2.connection?.isp || data2.connection?.org || 'ISP',
            lat: data2.latitude,
            lon: data2.longitude,
            locationString: `${data2.city || 'Dhaka'}, ${data2.country || 'Bangladesh'}`
          };
        }
      }
    } catch (e) {}

    return {
      ip: targetIp && targetIp !== '127.0.0.1' ? targetIp : '103.230.104.12',
      city: 'Dhaka',
      region: 'Dhaka Division',
      country: 'Bangladesh',
      countryCode: 'BD',
      timezone: 'Asia/Dhaka',
      isp: 'Broadband / Mobile Network',
      locationString: 'Dhaka, Bangladesh'
    };
  }

  // Session & Tracker Info Endpoint
  app.all('/api/tracker/session-info', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string) || '';
      const clientHints = req.body || req.query || {};

      const geo = await resolveGeo(clientIp);
      const device = parseDeviceDetails(userAgent, clientHints);

      res.json({
        success: true,
        ip: geo.ip || clientIp,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        countryCode: geo.countryCode,
        timezone: clientHints.timezone || geo.timezone,
        isp: geo.isp,
        location: geo.locationString,
        deviceModel: device.deviceModel,
        deviceType: device.deviceType,
        os: device.os,
        browser: device.browser,
        screen: clientHints.screen ? `${clientHints.screen.width}x${clientHints.screen.height}` : undefined,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Session info error:', error);
      res.json({
        success: true,
        ip: '103.230.104.12',
        city: 'Dhaka',
        region: 'Dhaka',
        country: 'Bangladesh',
        countryCode: 'BD',
        location: 'Dhaka, Bangladesh',
        deviceModel: 'Web Client',
        deviceType: 'Desktop',
        os: 'Windows / Mac',
        browser: 'Browser',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Admin routing to prevent Vite from serving raw admin.js code on /admin
  app.get(['/admin', '/admin/'], (req, res) => {
    res.redirect('/admin.html');
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
    app.get(['/admin', '/admin/', '/admin.html'], (req, res) => {
      res.sendFile(path.join(distPath, 'admin.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
