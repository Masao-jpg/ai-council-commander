// 環境変数を最初に読み込む（他のimportより先）
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import debateRouter from './routes/debate';
import actionRouter from './routes/action';
import uploadRouter from './routes/upload';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// Root path
app.get('/', (req, res) => {
  res.json({
    message: 'AI Council Commander API',
    version: '3.1.0',
    endpoints: {
      health: '/api/health',
      debate: '/api/debate',
      action: '/api/action',
      upload: '/api/upload',
      debug: '/api/debug-credentials'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/debate', debateRouter);
app.use('/api/action', actionRouter);
app.use('/api/upload', uploadRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobile access: http://192.168.3.15:${PORT}`);
  console.log(`📝 Gemini API Key: ${process.env.GEMINI_API_KEY ? '✓ Configured' : '✗ Missing'}`);

  if (process.env.USE_MOCK === 'true') {
    console.log(`🎭 MOCK MODE: Using simulated AI responses (Gemini API disabled)`);
    console.log(`   To use real Gemini API, set USE_MOCK=false in server/.env`);
  } else {
    console.log(`✨ Using Gemini 2.5 Pro (Real AI Mode)`);
  }
});
