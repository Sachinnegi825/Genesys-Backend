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
exports.expressionRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
// --- Configuration ---
const router = (0, express_1.Router)();
exports.expressionRouter = router;
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const ENRICHR_URL = 'https://maayanlab.cloud/Enrichr';
// We can reuse the same Cloudinary upload logic
const uploadToCloudinary = (fileBuffer, fileName) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({ resource_type: "raw", public_id: fileName, folder: `genesys_expression/${Date.now()}` }, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
        uploadStream.end(fileBuffer);
    });
};
// Parser for the CSV/TSV file, now on the backend
const parseExpressionFile = (fileContent) => {
    const lines = fileContent.trim().split('\n');
    if (lines.length < 2)
        throw new Error("File must contain a header and at least one data row.");
    const header = lines.shift().trim().split(/[, \t]/).map(h => h.trim().toLowerCase());
    const findIndex = (names) => { var _a; return (_a = names.map(n => header.findIndex(h => h.includes(n))).find(i => i !== -1)) !== null && _a !== void 0 ? _a : -1; };
    const geneIdx = findIndex(['gene', 'symbol', 'id']);
    const log2fcIdx = findIndex(['log2', 'logfc']);
    const pvalIdx = findIndex(['pvalue', 'p.value', 'p-value', 'adj.p', 'fdr']);
    if (geneIdx === -1 || log2fcIdx === -1 || pvalIdx === -1)
        throw new Error("CSV/TSV must contain columns for gene, log2FoldChange, and p-value.");
    return lines.filter(l => l.trim()).map(line => {
        const values = line.trim().split(/[, \t]/);
        if (values.length <= Math.max(geneIdx, log2fcIdx, pvalIdx))
            return null;
        const gene = values[geneIdx];
        const log2FoldChange = parseFloat(values[log2fcIdx]);
        const pValue = parseFloat(values[pvalIdx]);
        if (!gene || isNaN(log2FoldChange) || isNaN(pValue))
            return null;
        return { gene, log2FoldChange, pValue };
    }).filter((d) => d !== null);
};
// Main route handler for gene expression file uploads
const expressionUploadHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        return res.status(500).json({ message: "File processing server error: req.file is missing." });
    }
    try {
        // 1. Upload original file to Cloudinary
        const uploadResult = yield uploadToCloudinary(req.file.buffer, req.file.originalname);
        // 2. Parse the file content in-memory
        const fileContent = req.file.buffer.toString('utf-8');
        const parsedData = parseExpressionFile(fileContent);
        if (parsedData.length === 0)
            throw new Error("No valid data rows could be parsed.");
        // 3. Perform enrichment on significantly upregulated genes
        const upRegulatedGenes = parsedData.filter(d => d.log2FoldChange > 1 && d.pValue < 0.05).map(d => d.gene);
        let pathways = [];
        if (upRegulatedGenes.length > 0) {
            const formData = new form_data_1.default();
            formData.append('list', upRegulatedGenes.join('\n'));
            const addListResponse = yield axios_1.default.post(`${ENRICHR_URL}/addList`, formData, { headers: formData.getHeaders() });
            const userListId = addListResponse.data.userListId;
            const enrichResponse = yield axios_1.default.get(`${ENRICHR_URL}/enrich`, { params: { userListId, backgroundType: 'KEGG_2021_Human' } });
            pathways = (enrichResponse.data['KEGG_2021_Human'] || []).slice(0, 10).map((p) => ({ rank: p[0], term: p[1], p_value: p[2], overlapping_genes: p[5] }));
        }
        else {
            console.log("No significantly upregulated genes found for enrichment.");
        }
        // 4. Send the complete result back to the frontend
        res.status(200).json({
            message: "Expression file processed successfully.",
            fileName: req.file.originalname,
            downloadURL: uploadResult.secure_url,
            storagePath: uploadResult.public_id,
            geneData: parsedData, // The full data for the volcano plot
            pathways: pathways, // The enrichment results
        });
    }
    catch (error) {
        console.error("Error during expression analysis:", error.message);
        res.status(500).json({ message: error.message || 'An unknown server error occurred.' });
    }
});
// --- Route Definition ---
router.post('/upload', upload.single('file'), expressionUploadHandler);
