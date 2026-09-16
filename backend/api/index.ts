import app from '../src/app';

// Vercel serverless entry point: the Express app itself is a valid
// (req, res) handler, so we just re-export it. All routing/middleware
// stays exactly as written for local dev.
export default app;
