import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Health check
app.use('/health', healthRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
