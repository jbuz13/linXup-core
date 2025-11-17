/**
 * LinXup Gemini AI Link Analyzer
 * Uses Google Gemini 1.5 Flash to analyze broken links and suggest fixes
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Importance level for broken links
 */
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Analysis result from Gemini AI
 */
export interface LinkAnalysisResult {
	intendedDestination: string;
	linkPurpose: string;
	importance: ImportanceLevel;
	businessImpact: string;
	suggestedFixes: string[];
	reasoning: string;
	priorityScore: number; // 0-100
}

/**
 * Input data for link analysis
 */
export interface BrokenLinkInput {
	brokenUrl: string;
	statusCode: number | null;
	foundOnUrl: string;
	foundOnTitle?: string;
	linkText?: string;
	htmlContext?: string;
	surroundingText?: string;
}

/**
 * Gemini Link Analyzer Class
 * Analyzes broken links using Google Gemini 2.0 Flash
 */
export class GeminiLinkAnalyzer {
	private genAI: GoogleGenerativeAI;
	private model: any;

	constructor(apiKey: string) {
		if (!apiKey) {
			throw new Error('Gemini API key is required');
		}
		this.genAI = new GoogleGenerativeAI(apiKey);
		this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
	}

	/**
	 * Analyze a broken link and provide intelligent insights
	 */
	public async analyzeContext(
		input: BrokenLinkInput,
	): Promise<LinkAnalysisResult> {
		const prompt = this.buildAnalysisPrompt(input);

		try {
			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			// Parse JSON response from Gemini
			const analysis = this.parseGeminiResponse(text);

			// Validate and return
			return this.validateAnalysis(analysis);
		} catch (error) {
			console.error('Gemini API error:', error);
			// Return fallback analysis on error
			return this.getFallbackAnalysis(input);
		}
	}

	/**
	 * Build the analysis prompt for Gemini
	 */
	private buildAnalysisPrompt(input: BrokenLinkInput): string {
		return `You are an expert web analyst helping identify broken links on a nonprofit website.

BROKEN LINK DETAILS:
- Broken URL: ${input.brokenUrl}
- HTTP Status Code: ${input.statusCode || 'unknown'}
- Found on page: ${input.foundOnUrl}
${input.foundOnTitle ? `- Page title: ${input.foundOnTitle}` : ''}
${input.linkText ? `- Link text: "${input.linkText}"` : ''}
${input.htmlContext ? `- HTML context: ${input.htmlContext}` : ''}
${input.surroundingText ? `- Surrounding text: ${input.surroundingText}` : ''}

TASK:
Analyze this broken link and provide insights in JSON format. Consider:

1. **Intended Destination**: What was this link supposed to point to?
2. **Link Purpose**: Why did the user put this link here?
3. **Importance**: How critical is this link? (critical/high/medium/low)
   - critical: Donation buttons, contact forms, main navigation
   - high: Important resources, program information
   - medium: Supporting content, related articles
   - low: Archived content, optional references
4. **Business Impact**: How does this broken link affect the nonprofit's mission?
5. **Suggested Fixes**: Provide 1-3 specific URL suggestions that might work
6. **Reasoning**: Explain your analysis
7. **Priority Score**: Rate urgency 0-100 (100 = most urgent)

Return ONLY valid JSON in this exact format:
{
  "intendedDestination": "string",
  "linkPurpose": "string",
  "importance": "critical|high|medium|low",
  "businessImpact": "string",
  "suggestedFixes": ["url1", "url2", "url3"],
  "reasoning": "string",
  "priorityScore": number
}`;
	}

	/**
	 * Parse Gemini's response into structured data
	 */
	private parseGeminiResponse(text: string): LinkAnalysisResult {
		try {
			// Remove markdown code blocks if present
			let jsonText = text.trim();
			if (jsonText.startsWith('```json')) {
				jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
			} else if (jsonText.startsWith('```')) {
				jsonText = jsonText.replace(/```\n?/g, '');
			}

			const parsed = JSON.parse(jsonText);

			return {
				intendedDestination: parsed.intendedDestination || 'Unknown',
				linkPurpose: parsed.linkPurpose || 'Unknown',
				importance: this.validateImportance(parsed.importance),
				businessImpact: parsed.businessImpact || 'Unknown impact',
				suggestedFixes: Array.isArray(parsed.suggestedFixes)
					? parsed.suggestedFixes
					: [],
				reasoning: parsed.reasoning || 'No reasoning provided',
				priorityScore: this.validatePriorityScore(parsed.priorityScore),
			};
		} catch (error) {
			console.error('Failed to parse Gemini response:', error);
			throw new Error(`Invalid JSON response from Gemini: ${text}`);
		}
	}

	/**
	 * Validate importance level
	 */
	private validateImportance(importance: string): ImportanceLevel {
		const validLevels: ImportanceLevel[] = ['critical', 'high', 'medium', 'low'];
		if (validLevels.includes(importance as ImportanceLevel)) {
			return importance as ImportanceLevel;
		}
		return 'medium'; // Default fallback
	}

	/**
	 * Validate and normalize priority score
	 */
	private validatePriorityScore(score: any): number {
		const numScore = Number(score);
		if (Number.isNaN(numScore)) return 50;
		if (numScore < 0) return 0;
		if (numScore > 100) return 100;
		return Math.round(numScore);
	}

	/**
	 * Validate the complete analysis result
	 */
	private validateAnalysis(analysis: LinkAnalysisResult): LinkAnalysisResult {
		return {
			intendedDestination:
				analysis.intendedDestination || 'Unknown destination',
			linkPurpose: analysis.linkPurpose || 'Unknown purpose',
			importance: this.validateImportance(analysis.importance),
			businessImpact: analysis.businessImpact || 'Impact unclear',
			suggestedFixes: Array.isArray(analysis.suggestedFixes)
				? analysis.suggestedFixes.slice(0, 3)
				: [],
			reasoning: analysis.reasoning || 'No reasoning available',
			priorityScore: this.validatePriorityScore(analysis.priorityScore),
		};
	}

	/**
	 * Provide fallback analysis when Gemini API fails
	 */
	private getFallbackAnalysis(input: BrokenLinkInput): LinkAnalysisResult {
		// Determine importance based on link characteristics
		let importance: ImportanceLevel = 'medium';
		let priorityScore = 50;

		const linkTextLower = (input.linkText || '').toLowerCase();
		const urlLower = input.brokenUrl.toLowerCase();

		// Critical indicators
		if (
			linkTextLower.includes('donate') ||
			linkTextLower.includes('donation') ||
			urlLower.includes('/donate')
		) {
			importance = 'critical';
			priorityScore = 95;
		} else if (
			linkTextLower.includes('contact') ||
			linkTextLower.includes('apply') ||
			linkTextLower.includes('register')
		) {
			importance = 'critical';
			priorityScore = 90;
		}
		// High priority indicators
		else if (
			linkTextLower.includes('program') ||
			linkTextLower.includes('service') ||
			linkTextLower.includes('about')
		) {
			importance = 'high';
			priorityScore = 70;
		}
		// Low priority indicators
		else if (
			linkTextLower.includes('archive') ||
			urlLower.includes('/archive/') ||
			urlLower.includes('/old/')
		) {
			importance = 'low';
			priorityScore = 25;
		}

		return {
			intendedDestination: `Page or resource related to: ${input.linkText || 'unknown content'}`,
			linkPurpose: 'Unable to analyze - Gemini API unavailable',
			importance,
			businessImpact:
				importance === 'critical'
					? 'May prevent users from taking important actions'
					: 'May reduce user experience quality',
			suggestedFixes: [
				// Suggest checking homepage or similar paths
				input.foundOnUrl.replace(/\/[^/]*$/, ''),
				input.brokenUrl.replace(/\/$/, ''),
			],
			reasoning:
				'Fallback analysis due to API error. Based on link text and URL patterns.',
			priorityScore,
		};
	}

	/**
	 * Batch analyze multiple broken links
	 */
	public async analyzeBatch(
		inputs: BrokenLinkInput[],
	): Promise<LinkAnalysisResult[]> {
		const results: LinkAnalysisResult[] = [];

		for (const input of inputs) {
			try {
				const result = await this.analyzeContext(input);
				results.push(result);

				// Rate limiting: wait 1 second between requests to respect API limits
				if (inputs.length > 1) {
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			} catch (error) {
				console.error(
					`Failed to analyze ${input.brokenUrl}:`,
					error,
				);
				results.push(this.getFallbackAnalysis(input));
			}
		}

		return results;
	}

	/**
	 * Test connection to Gemini API
	 */
	public async testConnection(): Promise<boolean> {
		try {
			const result = await this.model.generateContent(
				'Respond with just the word "OK" if you can read this.',
			);
			const response = await result.response;
			const text = response.text();
			console.log('✅ Gemini API connection successful:', text.trim());
			return true;
		} catch (error) {
			console.error('❌ Gemini API connection failed:', error);
			return false;
		}
	}
}

/**
 * Create a Gemini analyzer instance from environment variables
 */
export function createGeminiAnalyzer(): GeminiLinkAnalyzer {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error(
			'GEMINI_API_KEY environment variable is required. Get your key from https://aistudio.google.com/app/apikey',
		);
	}
	return new GeminiLinkAnalyzer(apiKey);
}
