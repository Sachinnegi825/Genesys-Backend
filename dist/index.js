"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const analysis_1 = require("./routes/analysis");
const chat_1 = require("./routes/chat");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const literature_1 = require("./routes/literature");
const expression_1 = require("./routes/expression");
dotenv_1.default.config();
const envPath = path_1.default.resolve(__dirname, '../.env');
dotenv_1.default.config({ path: envPath });
const app = (0, express_1.default)();
const port = 3001; // Port for the backend API
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ✅ Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});
// Basic route
app.get('/', (req, res) => {
    res.send('Genetic Research AI Platform Backend is running!');
});
// API Routes
app.use('/api/chat', chat_1.chatRouter);
app.use('/api/analysis', analysis_1.analysisRouter);
app.use('/api/literature', literature_1.literatureRouter);
app.use('/api/expression', expression_1.expressionRouter);
app.listen(port, () => {
    console.log(`Backend server listening on http://localhost:${port}`);
});
