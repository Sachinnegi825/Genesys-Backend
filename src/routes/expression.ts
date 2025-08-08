import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import axios from 'axios';
import FormData from 'form-data';

// --- Configuration ---
const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const ENRICHR_URL = 'https://maayanlab.cloud/Enrichr';


// We can reuse the same Cloudinary upload logic
const uploadToCloudinary = (fileBuffer: Buffer, fileName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ resource_type: "raw", public_id: fileName, folder: `genesys_expression/${Date.now()}` }, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    uploadStream.end(fileBuffer);
  });
};

// Parser for the CSV/TSV file, now on the backend
const parseExpressionFile = (fileContent: string): { gene: string, log2FoldChange: number, pValue: number }[] => {
    const lines = fileContent.trim().split('\n');
    if (lines.length < 2) throw new Error("File must contain a header and at least one data row.");
    const header = lines.shift()!.trim().split(/[, \t]/).map(h => h.trim().toLowerCase());
    const findIndex = (names: string[]) => names.map(n => header.findIndex(h => h.includes(n))).find(i => i !== -1) ?? -1;
    const geneIdx = findIndex(['gene', 'symbol', 'id']);
    const log2fcIdx = findIndex(['log2', 'logfc']);
    const pvalIdx = findIndex(['pvalue', 'p.value', 'p-value', 'adj.p', 'fdr']);
    if (geneIdx === -1 || log2fcIdx === -1 || pvalIdx === -1) throw new Error("CSV/TSV must contain columns for gene, log2FoldChange, and p-value.");
    return lines.filter(l => l.trim()).map(line => {
        const values = line.trim().split(/[, \t]/);
        if (values.length <= Math.max(geneIdx, log2fcIdx, pvalIdx)) return null;
        const gene = values[geneIdx];
        const log2FoldChange = parseFloat(values[log2fcIdx]);
        const pValue = parseFloat(values[pvalIdx]);
        if (!gene || isNaN(log2FoldChange) || isNaN(pValue)) return null;
        return { gene, log2FoldChange, pValue };
    }).filter((d): d is { gene: string, log2FoldChange: number, pValue: number } => d !== null);
};


// Main route handler for gene expression file uploads
const expressionUploadHandler = async (req: Request, res: Response) => {
    if (!req.file) {
        return res.status(500).json({ message: "File processing server error: req.file is missing." });
    }

    try {
        // 1. Upload original file to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);

        // 2. Parse the file content in-memory
        const fileContent = req.file.buffer.toString('utf-8');
        const parsedData = parseExpressionFile(fileContent);
        if (parsedData.length === 0) throw new Error("No valid data rows could be parsed.");

        // 3. Perform enrichment on significantly upregulated genes
        const upRegulatedGenes = parsedData.filter(d => d.log2FoldChange > 1 && d.pValue < 0.05).map(d => d.gene);
        let pathways: any[] = [];
        if (upRegulatedGenes.length > 0) {
            const formData = new FormData();
            formData.append('list', upRegulatedGenes.join('\n'));
            const addListResponse = await axios.post(`${ENRICHR_URL}/addList`, formData, { headers: formData.getHeaders() });
            const userListId = addListResponse.data.userListId;
            const enrichResponse = await axios.get(`${ENRICHR_URL}/enrich`, { params: { userListId, backgroundType: 'KEGG_2021_Human' } });
            pathways = (enrichResponse.data['KEGG_2021_Human'] || []).slice(0, 10).map((p: any[]) => ({ rank: p[0], term: p[1], p_value: p[2], overlapping_genes: p[5] }));
        } else {
            console.log("No significantly upregulated genes found for enrichment.");
        }

        // 4. Send the complete result back to the frontend
        res.status(200).json({
            message: "Expression file processed successfully.",
            fileName: req.file.originalname,
            downloadURL: uploadResult.secure_url,
            storagePath: uploadResult.public_id,
            geneData: parsedData, // The full data for the volcano plot
            pathways: pathways,    // The enrichment results
        });

    } catch (error: any) {
        console.error("Error during expression analysis:", error.message);
        res.status(500).json({ message: error.message || 'An unknown server error occurred.' });
    }
};

// --- Route Definition ---
router.post('/upload', upload.single('file'), expressionUploadHandler);

export { router as expressionRouter };