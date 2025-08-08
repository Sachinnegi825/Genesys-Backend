export interface VcfVariant {
gene: string;
position: string;
ref: string;
alt: string[];
quality: number;
}
/**
Defines the structure for a parsed result from a FASTA file.
*/
export interface FastaSequence {
id: string;
sequence_preview: string;
}
/**
Defines the structure for a parsed result from a BAM file.
*/
export interface BamAlignment {
alignment_data: string;
}

export interface AnalysisDocument {
id: string;
type: 'vcf' | 'fasta' | 'bam' | 'unknown';
fileName: string;
results: (VcfVariant | FastaSequence | BamAlignment)[];
createdAt: Date; // Or 'Timestamp' if you are using the Firestore Timestamp object

}



export interface LiteratureSearchDocument {
    id: string;
    searchTerm: string;
    summary: string;
    relationships: string[];
    articles: any[]; // Array of parsed PubMed articles
    createdAt: any; // Firestore Timestamp
}

/**
 * Represents the result of a gene expression enrichment analysis.
 * This is the context for the "Gene Expression" view.
 */
export interface ExpressionData {
    upRegulated: string[]; // List of significantly upregulated genes
    pathways: any[]; // Array of top enriched pathways from Enrichr
}

/**
 * Defines the structure for a single chat message saved to Firestore.
 */
export interface ChatMessageDocument {
    sender: 'user' | 'ai';
    text: string;
    createdAt?: any; // Firestore Timestamp
}