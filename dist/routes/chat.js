"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = require("express");
const ai_service_1 = require("../services/ai.service"); // Import the single, smart function
const router = (0, express_1.Router)();
exports.chatRouter = router;
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { prompt, context } = req.body;
    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required.' });
    }
    try {
        // Pass the entire context object directly to the AI service
        const aiMessage = yield (0, ai_service_1.getAiResponse)(prompt, context);
        res.status(200).json({ response: aiMessage });
    }
    catch (error) {
        console.error("Error in chat route:", error);
        res.status(500).json({ response: "An internal server error occurred." });
    }
}));
