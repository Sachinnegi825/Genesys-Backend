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
exports.analysisRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const vcf_1 = __importDefault(require("@gmod/vcf"));
const fasta_parser_1 = __importDefault(require("fasta-parser"));
const stream_1 = require("stream");
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const router = (0, express_1.Router)();
exports.analysisRouter = router;
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// --- Upload Helper ---
const uploadToCloudinary = (fileBuffer, fileName) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            resource_type: "raw",
            public_id: fileName,
            folder: `genesys_analyses/${Date.now()}`
        }, (error, result) => {
            if (error)
                return reject(error);
            resolve(result);
        });
        uploadStream.end(fileBuffer);
    });
};
// --- File Upload Handler ---
const fileUploadHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
    }
    try {
        const uploadResult = yield uploadToCloudinary(req.file.buffer, req.file.originalname);
        console.log(`File uploaded to Cloudinary. URL: ${uploadResult.secure_url}`);
        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname.toLowerCase();
        const onParseComplete = (analysisType, results) => {
            res.status(200).json({
                message: 'File uploaded and parsed successfully.',
                analysisType,
                fileName: req.file.originalname,
                downloadURL: uploadResult.secure_url,
                storagePath: uploadResult.public_id,
                results,
            });
        };
        if (fileName.endsWith('.vcf')) {
            yield parseVcf(fileBuffer, onParseComplete);
        }
        else if (fileName.endsWith('.fasta') || fileName.endsWith('.fa')) {
            yield parseFasta(fileBuffer, onParseComplete);
        }
        else if (fileName.endsWith('.bam')) {
            yield parseBam(fileBuffer, onParseComplete);
        }
        else {
            res.status(400).json({ message: `Unsupported file type: ${fileName}` });
        }
    }
    catch (error) {
        console.error("Error during file upload or parsing:", error);
        res.status(500).json({ message: error.message || 'An unknown error occurred.' });
    }
});
// --- VCF Parser ---
function parseVcf(buffer, onComplete) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            const fileContent = buffer.toString('utf-8');
            const lines = fileContent.split('\n');
            const headerLines = lines.filter(l => l.startsWith('#')).join('\n');
            const parser = new vcf_1.default({ header: headerLines });
            const variants = [];
            for (const line of lines) {
                if (!line || line.startsWith('#'))
                    continue;
                const record = parser.parseLine(line);
                if (!record)
                    continue;
                variants.push({
                    gene: ((_a = record.INFO) === null || _a === void 0 ? void 0 : _a.SYMBOL) || 'N/A',
                    position: `${record.CHROM}:${record.POS}`,
                    ref: record.REF || "",
                    alt: record.ALT || "" || [],
                    quality: record.QUAL || "" || 0,
                });
            }
            onComplete('vcf', variants);
        }
        catch (error) {
            throw new Error(`VCF parsing failed: ${error.message}`);
        }
    });
}
// --- FASTA Parser ---
function parseFasta(buffer, onComplete) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileContent = buffer.toString('utf-8');
        const readableStream = stream_1.Readable.from(fileContent);
        const parser = new fasta_parser_1.default();
        const sequences = [];
        parser.on('data', (data) => {
            const entry = data.toString().split('\n');
            const idLine = entry.shift() || '';
            const id = idLine.substring(1).split(' ')[0];
            sequences.push({
                id,
                sequence_preview: entry.join('').substring(0, 50) + '...',
            });
        });
        parser.on('end', () => {
            onComplete('fasta', sequences);
        });
        readableStream.pipe(parser);
    });
}
// --- BAM Parser ---
function parseBam(buffer, onComplete) {
    return __awaiter(this, void 0, void 0, function* () {
        const samtools = (0, child_process_1.spawn)('samtools', ['view', '-h', '-']);
        let samOutput = '';
        let errorOutput = '';
        samtools.stdout.on('data', data => (samOutput += data.toString()));
        samtools.stderr.on('data', data => (errorOutput += data.toString()));
        samtools.on('close', code => {
            if (code !== 0) {
                throw new Error(`samtools failed with code ${code}: ${errorOutput}`);
            }
            const alignments = samOutput
                .split('\n')
                .filter(line => line && !line.startsWith('@'))
                .slice(0, 20)
                .map(line => ({ alignment_data: line }));
            onComplete('bam', alignments);
        });
        samtools.stdin.write(buffer);
        samtools.stdin.end();
    });
}
// --- Routes ---
router.post('/upload/file', upload.single('file'), fileUploadHandler);
router.post('/upload/dna', upload.single('file'), fileUploadHandler);
