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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiResponseForLiterature = exports.getAiResponse = void 0;
// 1. Import the Google SDK
const generative_ai_1 = require("@google/generative-ai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// 2. Initialize the Gemini client
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// --- PROMPT BUILDER FOR DNA ANALYSIS ---
const _buildDnaPrompt = (analyses) => {
    if (!analyses || analyses.length === 0)
        return "No DNA/FASTA/BAM files have been analyzed yet.";
    return analyses.slice(0, 2).map((analysis, i) => `--- CONTEXT FROM FILE #${i + 1}: "${analysis.fileName}" (Type: ${analysis.type.toUpperCase()}) ---\n` + JSON.stringify(analysis.results.slice(0, 10), null, 2)).join('\n\n');
};
// --- PROMPT BUILDER FOR LITERATURE SYNOPSIS ---
const _buildLiteraturePrompt = (literature) => {
    if (!literature)
        return "No literature search has been performed yet.";
    return `--- CONTEXT FROM LITERATURE SEARCH for term: "${literature.searchTerm}" ---\n`
        + `AI Summary: ${literature.summary}\n`
        + `Key Relationships: ${JSON.stringify(literature.relationships)}\n`
        + `Top 3 Article Abstracts: ${literature.articles.slice(0, 3).map(a => a.abstract).join('\n---\n')}`;
};
// --- PROMPT BUILDER FOR GENE EXPRESSION ---
const _buildExpressionPrompt = (expression) => {
    if (!expression)
        return "No gene expression analysis has been performed yet.";
    return `--- CONTEXT FROM GENE EXPRESSION ANALYSIS ---\n`
        + `The user analyzed a gene expression file and found ${expression.upRegulated.length} significantly upregulated genes.\n`
        + `A pathway enrichment analysis was run on these genes, which found these top pathways:\n`
        + JSON.stringify(expression.pathways, null, 2);
};
/**
 * Main AI entry point. It directs traffic to the correct prompt builder.
 */
const getAiResponse = (userPrompt, context) => __awaiter(void 0, void 0, void 0, function* () {
    const { activeView, analyses, literature, expression } = context;
    let formattedContext = "No context available for the current view.";
    // Build context based on the user's active screen
    switch (activeView) {
        case 'dna':
            formattedContext = _buildDnaPrompt(analyses);
            break;
        case 'literature':
            formattedContext = _buildLiteraturePrompt(literature);
            break;
        case 'expression':
            formattedContext = _buildExpressionPrompt(expression);
            break;
    }
    const fullPrompt = `
      You are GeneSys AI, a specialized bioinformatics assistant. Your persona is professional, knowledgeable, and helpful.
      Your answer MUST be based ONLY on the information within the "DATA CONTEXT" section.
      If the data is insufficient, state that clearly. Format your responses using Markdown.

      ========================= DATA CONTEXT (User is on the ${activeView.toUpperCase()} page) =========================
      ${formattedContext}
      ================================================================

      ================================= USER'S QUESTION =================================
      ${userPrompt}
      ================================================================
    `;
    try {
        const result = yield model.generateContent(fullPrompt);
        const response = yield result.response;
        return response.text();
    }
    catch (error) {
        console.error("Error calling Google Gemini API:", error);
        return "I'm sorry, I encountered an error connecting to the AI. The model may have blocked the request due to safety settings. Please check the server logs.";
    }
});
exports.getAiResponse = getAiResponse;
const getAiResponseForLiterature = (searchTerm, articles) => __awaiter(void 0, void 0, void 0, function* () {
    const context = articles
        .map(article => `PMID ${article.pmid}:\n${article.abstract}`)
        .join('\n\n---\n\n');
    const fullPrompt = `
      You are GeneSys AI, a specialized bioinformatics research assistant.
      Your task is to analyze a collection of scientific abstracts related to the user's search term.

      **Your Rules:**
      1.  Based on the provided abstracts, synthesize a high-level summary of the key findings.
      2.  Extract critical relationships in the format "GENE_NAME - Interacts with/Affects/Is associated with - DISEASE/OTHER_GENE/PATHWAY".
      3.  If the abstracts are not relevant or insufficient, state that.
      4.  Your response MUST be in a valid JSON format, like this:
          {"summary": "Your detailed summary here.", "relationships": ["BRCA1 - Is associated with - Breast Cancer", "TP53 - Affects - DNA Repair Pathway"]}

      ====================== USER'S SEARCH TERM ======================
      ${searchTerm}
      ================================================================

      ========================= ABSTRACTS DATA =========================
      ${context}
      ================================================================
    `;
    try {
        const result = yield model.generateContent(fullPrompt);
        const response = yield result.response;
        const text = response.text();
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    }
    catch (error) {
        console.error("Error calling Gemini for literature analysis:", error);
        return {
            summary: "I encountered an error while trying to summarize the literature. The AI may not have returned a valid response.",
            relationships: [],
        };
    }
});
exports.getAiResponseForLiterature = getAiResponseForLiterature;
