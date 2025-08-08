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
exports.literatureRouter = void 0;
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const ai_service_1 = require("../services/ai.service");
const xml2js_1 = require("xml2js"); // At the top with other imports
const router = (0, express_1.Router)();
exports.literatureRouter = router;
const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
router.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    const term = req.query.term;
    if (!term) {
        return res.status(400).json({ message: 'A search term is required.' });
    }
    try {
        // Step 1: Search PubMed for article PMIDs
        const searchResponse = yield axios_1.default.get(`${PUBMED_BASE_URL}/esearch.fcgi`, {
            params: {
                db: 'pubmed',
                term,
                retmax: 5,
                sort: 'relevance',
                retmode: 'json'
            }
        });
        const pmids = ((_a = searchResponse.data.esearchresult) === null || _a === void 0 ? void 0 : _a.idlist) || [];
        if (pmids.length === 0) {
            return res.status(200).json({
                summary: "No relevant articles found on PubMed for this term.",
                articles: [],
                relationships: []
            });
        }
        // Step 2: Fetch abstracts and metadata for the found PMIDs
        const fetchResponse = yield axios_1.default.get(`${PUBMED_BASE_URL}/efetch.fcgi`, {
            params: {
                db: 'pubmed',
                id: pmids.join(','),
                retmode: 'xml'
            }
        });
        const parsedXml = yield (0, xml2js_1.parseStringPromise)(fetchResponse.data);
        const articles = [];
        const pubmedArticles = ((_b = parsedXml === null || parsedXml === void 0 ? void 0 : parsedXml.PubmedArticleSet) === null || _b === void 0 ? void 0 : _b.PubmedArticle) || [];
        for (const item of pubmedArticles) {
            const medlineCitation = (_c = item.MedlineCitation) === null || _c === void 0 ? void 0 : _c[0];
            const articleData = (_d = medlineCitation === null || medlineCitation === void 0 ? void 0 : medlineCitation.Article) === null || _d === void 0 ? void 0 : _d[0];
            const pmid = ((_f = (_e = medlineCitation === null || medlineCitation === void 0 ? void 0 : medlineCitation.PMID) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f._) || '';
            const title = ((_g = articleData === null || articleData === void 0 ? void 0 : articleData.ArticleTitle) === null || _g === void 0 ? void 0 : _g[0]) || '';
            const abstractTextArray = ((_j = (_h = articleData === null || articleData === void 0 ? void 0 : articleData.Abstract) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.AbstractText) || [];
            const abstract = abstractTextArray.map((t) => (typeof t === 'string' ? t : t._ || '')).join(' ');
            const authorsArray = ((_l = (_k = articleData === null || articleData === void 0 ? void 0 : articleData.AuthorList) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.Author) || [];
            const authors = authorsArray.map((a) => {
                var _a, _b;
                const last = ((_a = a === null || a === void 0 ? void 0 : a.LastName) === null || _a === void 0 ? void 0 : _a[0]) || '';
                const first = ((_b = a === null || a === void 0 ? void 0 : a.ForeName) === null || _b === void 0 ? void 0 : _b[0]) || '';
                return `${first} ${last}`.trim();
            });
            const journal = ((_p = (_o = (_m = articleData === null || articleData === void 0 ? void 0 : articleData.Journal) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.Title) === null || _p === void 0 ? void 0 : _p[0]) || '';
            articles.push({ pmid, title, abstract, authors, journal });
        }
        // Step 4: Summarize using AI
        const aiSummary = yield (0, ai_service_1.getAiResponseForLiterature)(term, articles);
        return res.status(200).json({
            summary: aiSummary.summary,
            relationships: aiSummary.relationships,
            articles
        });
    }
    catch (error) {
        console.error('Error in literature search:', error.message);
        return res.status(500).json({ message: 'Failed to fetch or process literature from PubMed.' });
    }
}));
