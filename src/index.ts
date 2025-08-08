import express from 'express';
import cors from 'cors';
import { analysisRouter } from './routes/analysis';
import { chatRouter } from './routes/chat';
import dotenv from "dotenv";
import path from "path";
import { literatureRouter } from './routes/literature';
import { expressionRouter } from './routes/expression';

dotenv.config();

const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const app = express();
const port = 3001; // Port for the backend API

app.use(cors()); // Allow requests from your React frontend
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Genetic Research AI Platform Backend is running!');
});

// API Routes
app.use('/api/chat', chatRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/literature', literatureRouter);
app.use('/api/expression', expressionRouter);




app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});