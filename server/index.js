import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initStorage } from './storage.js';
import participantRoutes from './routes/participant.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration: Allow local Vite dev server
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Tech Trek 2026 Event Engine', time: new Date().toISOString() });
});

// API Routes
app.use('/api/participant', participantRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler for API routes
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'API route not found.' });
  }
  next();
});

app.use(express.static(distPath));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal server error occurred.',
  });
});

// SPA fallback for all non-API GET requests (Express 5 syntax)
app.get('{*path}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
async function startServer() {
  try {
    await initStorage();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`⚡ [Tech Trek Engine] Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal error during server startup:', err);
    process.exit(1);
  }
}

startServer();

export default app;
