import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import VCF from '@gmod/vcf';
import Fasta from 'fasta-parser';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// --- Type Definitions ---
interface Variant {
  gene: string;
  position: string;
  ref: string;
  alt: string[];
  quality: number;
}
interface FastaSequence {
  id: string;
  sequence_preview: string;
}
interface BamAlignment {
  alignment_data: string;
}

// --- Upload Helper ---
const uploadToCloudinary = (fileBuffer: Buffer, fileName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: fileName,
        folder: `genesys_analyses/${Date.now()}`
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// --- File Upload Handler ---
const fileUploadHandler = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    const uploadResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    console.log(`File uploaded to Cloudinary. URL: ${uploadResult.secure_url}`);

    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname.toLowerCase();

    const onParseComplete = (
      analysisType: string,
      results: Variant[] | FastaSequence[] | BamAlignment[]
    ) => {
      res.status(200).json({
        message: 'File uploaded and parsed successfully.',
        analysisType,
        fileName: req.file!.originalname,
        downloadURL: uploadResult.secure_url,
        storagePath: uploadResult.public_id,
        results,
      });
    };

    if (fileName.endsWith('.vcf')) {
      await parseVcf(fileBuffer, onParseComplete);
    } else if (fileName.endsWith('.fasta') || fileName.endsWith('.fa')) {
      await parseFasta(fileBuffer, onParseComplete);
    } else if (fileName.endsWith('.bam')) {
      await parseBam(fileBuffer, onParseComplete);
    } else {
      res.status(400).json({ message: `Unsupported file type: ${fileName}` });
    }

  } catch (error: any) {
    console.error("Error during file upload or parsing:", error);
    res.status(500).json({ message: error.message || 'An unknown error occurred.' });
  }
};

// --- VCF Parser ---
async function parseVcf(
  buffer: Buffer,
  onComplete: (type: string, results: Variant[]) => void
) {
  try {
    const fileContent = buffer.toString('utf-8');
    const lines = fileContent.split('\n');
    const headerLines = lines.filter(l => l.startsWith('#')).join('\n');
    const parser = new VCF({ header: headerLines });

    const variants: Variant[] = [];

    for (const line of lines) {
      if (!line || line.startsWith('#')) continue;
      const record = parser.parseLine(line);

      if (!record) continue;

      variants.push({
        gene: record.INFO?.SYMBOL || 'N/A',
        position: `${record.CHROM}:${record.POS}`,
        ref: record.REF || "",
        alt: record.ALT || "" || [],
        quality: record.QUAL || "" || 0,
      });
    }

    onComplete('vcf', variants);
  } catch (error) {
    throw new Error(`VCF parsing failed: ${(error as Error).message}`);
  }
}

// --- FASTA Parser ---
async function parseFasta(
  buffer: Buffer,
  onComplete: (type: string, results: FastaSequence[]) => void
) {
  const fileContent = buffer.toString('utf-8');
  const readableStream = Readable.from(fileContent);
  const parser = new Fasta();

  const sequences: FastaSequence[] = [];

  parser.on('data', (data: Buffer) => {
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
}

// --- BAM Parser ---
async function parseBam(
  buffer: Buffer,
  onComplete: (type: string, results: BamAlignment[]) => void
) {
  const samtools = spawn('samtools', ['view', '-h', '-']);
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
}

// --- Routes ---
router.post('/upload/file', upload.single('file'), fileUploadHandler);
router.post('/upload/dna', upload.single('file'), fileUploadHandler);

export { router as analysisRouter };
