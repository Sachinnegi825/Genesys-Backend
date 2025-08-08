import { Router, Request, Response } from 'express';
import axios from 'axios';
import { getAiResponseForLiterature } from '../services/ai.service';
import { parseStringPromise } from 'xml2js'; // At the top with other imports


const router = Router();
const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
}

router.get('/search', async (req: Request, res: Response) => {
  const term = req.query.term as string;
  if (!term) {
    return res.status(400).json({ message: 'A search term is required.' });
  }

  try {
    // Step 1: Search PubMed for article PMIDs
    const searchResponse = await axios.get(`${PUBMED_BASE_URL}/esearch.fcgi`, {
      params: {
        db: 'pubmed',
        term,
        retmax: 5,
        sort: 'relevance',
        retmode: 'json'
      }
    });

    const pmids: string[] = searchResponse.data.esearchresult?.idlist || [];
    if (pmids.length === 0) {
      return res.status(200).json({
        summary: "No relevant articles found on PubMed for this term.",
        articles: [],
        relationships: []
      });
    }

    // Step 2: Fetch abstracts and metadata for the found PMIDs
    const fetchResponse = await axios.get(`${PUBMED_BASE_URL}/efetch.fcgi`, {
      params: {
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'xml'
      }
    });


    const parsedXml = await parseStringPromise(fetchResponse.data);
    const articles: PubMedArticle[] = [];

    const pubmedArticles = parsedXml?.PubmedArticleSet?.PubmedArticle || [];

    for (const item of pubmedArticles) {
      const medlineCitation = item.MedlineCitation?.[0];
      const articleData = medlineCitation?.Article?.[0];

      const pmid = medlineCitation?.PMID?.[0]?._ || '';
      const title = articleData?.ArticleTitle?.[0] || '';
      const abstractTextArray = articleData?.Abstract?.[0]?.AbstractText || [];
      const abstract = abstractTextArray.map((t: any) => (typeof t === 'string' ? t : t._ || '')).join(' ');

      const authorsArray = articleData?.AuthorList?.[0]?.Author || [];
      const authors = authorsArray.map((a: any) => {
        const last = a?.LastName?.[0] || '';
        const first = a?.ForeName?.[0] || '';
        return `${first} ${last}`.trim();
      });

      const journal = articleData?.Journal?.[0]?.Title?.[0] || '';

      articles.push({ pmid, title, abstract, authors, journal });
    }

    // Step 4: Summarize using AI
    const aiSummary = await getAiResponseForLiterature(term, articles);

    return res.status(200).json({
      summary: aiSummary.summary,
      relationships: aiSummary.relationships,
      articles
    });

  } catch (error: any) {
    console.error('Error in literature search:', error.message);
    return res.status(500).json({ message: 'Failed to fetch or process literature from PubMed.' });
  }
});

export { router as literatureRouter };
