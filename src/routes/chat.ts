import { Router, Request, Response } from 'express';
import { getAiResponse } from '../services/ai.service'; // Import the single, smart function

const router = Router();

router.post('/', async (req: Request, res: Response) => {
    const { prompt, context } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required.' });
    }

    try {
        // Pass the entire context object directly to the AI service
        const aiMessage = await getAiResponse(prompt, context);
        res.status(200).json({ response: aiMessage });
    } catch (error) {
        console.error("Error in chat route:", error);
        res.status(500).json({ response: "An internal server error occurred." });
    }
});

export { router as chatRouter };