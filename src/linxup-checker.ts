/**
 * LinXup Intelligent Link Checker
 * Extends Linkinator with AI-powered analysis and database storage
 */

import {
	LinkChecker,
	type CheckOptions,
	type CrawlResult,
	type LinkResult,
	LinkState,
} from './index.js';
import {
	type Database,
	type ScanResult,
	type BrokenLink,
	type AIAnalysis,
	type SuggestedFix,
} from './persistence/database.js';
import {
	type GeminiLinkAnalyzer,
	type BrokenLinkInput,
	type LinkAnalysisResult,
} from './ai/gemini-analyzer.js';

/**
 * Enhanced scan result with AI analysis
 */
export interface IntelligentScanResult extends CrawlResult {
	scanId: number;
	websiteId: number;
	totalLinks: number;
	brokenLinksCount: number;
	healthScore: number;
	brokenLinksWithAI: BrokenLinkWithAI[];
	scanDuration: number;
}

/**
 * Broken link with AI analysis details
 */
export interface BrokenLinkWithAI {
	url: string;
	statusCode: number | null;
	foundOn: string;
	linkText?: string;
	htmlContext?: string;
	aiAnalysis: LinkAnalysisResult;
	dbId: number;
}

/**
 * Options for intelligent scanning
 */
export interface IntelligentCheckOptions extends CheckOptions {
	websiteId: number;
	userId?: number;
	database: Database;
	aiAnalyzer: GeminiLinkAnalyzer;
	includeWaybackMachine?: boolean;
}

/**
 * LinXup Intelligent Link Checker
 * Combines Linkinator crawling with AI analysis and database storage
 */
export class LinXupChecker extends LinkChecker {
	private db: Database;
	private aiAnalyzer: GeminiLinkAnalyzer;
	private websiteId: number;
	private userId?: number;
	private includeWayback: boolean;

	constructor(
		db: Database,
		aiAnalyzer: GeminiLinkAnalyzer,
		websiteId: number,
		userId?: number,
		includeWayback = false,
	) {
		super();
		this.db = db;
		this.aiAnalyzer = aiAnalyzer;
		this.websiteId = websiteId;
		this.userId = userId;
		this.includeWayback = includeWayback;
	}

	/**
	 * Main intelligent scanning method
	 * Crawls website, analyzes broken links with AI, and saves to database
	 */
	public async checkWithIntelligence(
		options: CheckOptions,
	): Promise<IntelligentScanResult> {
		const startTime = Date.now();

		console.log('\n🚀 Starting LinXup Intelligent Scan...');
		console.log('==========================================');

		// Step 1: Create scan record in database
		const scanResult = await this.db.createScanResult(
			this.websiteId,
			this.userId ? 'manual' : 'scheduled',
			this.userId,
		);
		console.log(`✅ Scan record created (ID: ${scanResult.id})`);

		try {
			// Step 2: Run Linkinator crawl
			console.log('\n🔍 Crawling website...');
			const crawlResult = await this.check(options);
			console.log(`✅ Crawl complete: ${crawlResult.links.length} links found`);

			// Step 3: Filter broken links
			const brokenLinks = crawlResult.links.filter(
				(link) => link.state === LinkState.BROKEN,
			);
			console.log(`🔴 Found ${brokenLinks.length} broken links`);

			// Step 4: Analyze each broken link with AI
			const brokenLinksWithAI: BrokenLinkWithAI[] = [];

			if (brokenLinks.length > 0) {
				console.log('\n🤖 Analyzing broken links with Gemini AI...');

				for (let i = 0; i < brokenLinks.length; i++) {
					const link = brokenLinks[i];
					console.log(
						`\n[${i + 1}/${brokenLinks.length}] Analyzing: ${link.url}`,
					);

					try {
						// Extract context
						const context = await this.extractContext(link, options);

						// Prepare AI input
						const aiInput: BrokenLinkInput = {
							brokenUrl: link.url,
							statusCode: link.status || null,
							foundOnUrl: link.parent || options.path as string,
							linkText: context.linkText,
							htmlContext: context.htmlContext,
							surroundingText: context.surroundingText,
						};

						// Call Gemini AI
						const aiAnalysis = await this.aiAnalyzer.analyzeContext(aiInput);
						console.log(
							`  ✅ AI Analysis: ${aiAnalysis.importance.toUpperCase()} (Priority: ${aiAnalysis.priorityScore}/100)`,
						);

						// Add Wayback Machine suggestions if enabled
						if (this.includeWayback) {
							const waybackUrl = await this.checkWaybackMachine(link.url);
							if (waybackUrl) {
								aiAnalysis.suggestedFixes.unshift(waybackUrl);
								console.log('  📚 Added Wayback Machine archive');
							}
						}

						// Save broken link to database
						const brokenLinkRecord = await this.db.createBrokenLink(
							scanResult.id,
							link.url,
							link.status || null,
							link.parent || options.path as string,
							context.linkText,
							context.htmlContext,
						);

						// Update with AI analysis
						const aiAnalysisForDb: AIAnalysis = {
							intendedDestination: aiAnalysis.intendedDestination,
							linkPurpose: aiAnalysis.linkPurpose,
							importance: aiAnalysis.importance,
							businessImpact: aiAnalysis.businessImpact,
							reasoning: aiAnalysis.reasoning,
						};

						const suggestedFixesForDb: SuggestedFix[] =
							aiAnalysis.suggestedFixes.map((url) => ({
								url,
								source: url.includes('web.archive.org')
									? 'wayback'
									: 'gpt4',
								confidence: 0.8,
							}));

						await this.db.updateBrokenLinkWithAI(
							brokenLinkRecord.id,
							aiAnalysisForDb,
							suggestedFixesForDb,
							aiAnalysis.priorityScore,
							aiAnalysis.importance === 'critical',
						);

						brokenLinksWithAI.push({
							url: link.url,
							statusCode: link.status || null,
							foundOn: link.parent || options.path as string,
							linkText: context.linkText,
							htmlContext: context.htmlContext,
							aiAnalysis,
							dbId: brokenLinkRecord.id,
						});

						// Rate limiting: wait between AI calls
						if (i < brokenLinks.length - 1) {
							await new Promise((resolve) => setTimeout(resolve, 1000));
						}
					} catch (error) {
						console.error(`  ❌ Failed to analyze ${link.url}:`, error);
						// Continue with next link even if one fails
					}
				}
			}

			// Step 5: Calculate health score
			const healthScore = this.calculateHealthScore(
				crawlResult.links.length,
				brokenLinks.length,
			);
			console.log(`\n📊 Health Score: ${healthScore}/100`);

			// Step 6: Complete scan in database
			await this.db.completeScanResult(
				scanResult.id,
				crawlResult.links.length,
				brokenLinks.length,
				healthScore,
			);

			const scanDuration = Date.now() - startTime;
			console.log(`\n✅ Scan completed in ${(scanDuration / 1000).toFixed(2)}s`);
			console.log('==========================================\n');

			// Step 7: Return enhanced result
			return {
				...crawlResult,
				scanId: scanResult.id,
				websiteId: this.websiteId,
				totalLinks: crawlResult.links.length,
				brokenLinksCount: brokenLinks.length,
				healthScore,
				brokenLinksWithAI,
				scanDuration,
			};
		} catch (error) {
			console.error('\n❌ Scan failed:', error);
			// Mark scan as failed in database
			await this.db.query(
				"UPDATE scan_results SET status = 'failed', error_message = $2 WHERE id = $1",
				[scanResult.id, (error as Error).message],
			);
			throw error;
		}
	}

	/**
	 * Extract HTML context from a broken link
	 */
	private async extractContext(
		link: LinkResult,
		options: CheckOptions,
	): Promise<{
		linkText?: string;
		htmlContext?: string;
		surroundingText?: string;
	}> {
		// For now, return basic context
		// In a full implementation, we would fetch the parent page and parse it
		return {
			linkText: this.extractLinkText(link.url),
			htmlContext: `<a href="${link.url}">Link</a>`,
			surroundingText: undefined,
		};
	}

	/**
	 * Extract link text from URL (basic implementation)
	 */
	private extractLinkText(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;
			const segments = pathname.split('/').filter((s) => s);
			const lastSegment = segments[segments.length - 1] || 'Home';
			return lastSegment
				.replace(/[-_]/g, ' ')
				.replace(/\.(html|htm|php)$/, '')
				.split(' ')
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ');
		} catch {
			return 'Link';
		}
	}

	/**
	 * Check Wayback Machine for archived version
	 */
	private async checkWaybackMachine(url: string): Promise<string | null> {
		try {
			// Wayback Machine API to check if URL is archived
			const waybackApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
			const response = await fetch(waybackApiUrl);

			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as {
				archived_snapshots?: {
					closest?: {
						url?: string;
						available?: boolean;
					};
				};
			};

			if (data.archived_snapshots?.closest?.available) {
				return data.archived_snapshots.closest.url || null;
			}

			return null;
		} catch (error) {
			console.error('Wayback Machine check failed:', error);
			return null;
		}
	}

	/**
	 * Calculate health score based on broken links ratio
	 */
	private calculateHealthScore(
		totalLinks: number,
		brokenLinks: number,
	): number {
		if (totalLinks === 0) return 100;

		const brokenRatio = brokenLinks / totalLinks;
		const score = Math.round((1 - brokenRatio) * 100);

		return Math.max(0, Math.min(100, score));
	}

	/**
	 * Generate intelligent report
	 */
	public generateReport(result: IntelligentScanResult): string {
		let report = '\n';
		report += '╔═══════════════════════════════════════════════════════════════════════════════╗\n';
		report += '║                        LinXup Intelligent Scan Report                         ║\n';
		report += '╚═══════════════════════════════════════════════════════════════════════════════╝\n';
		report += '\n';
		report += `📊 SCAN SUMMARY\n`;
		report += `${'─'.repeat(80)}\n`;
		report += `Total Links Checked:    ${result.totalLinks}\n`;
		report += `Broken Links Found:     ${result.brokenLinksCount}\n`;
		report += `Health Score:           ${result.healthScore}/100 ${this.getHealthEmoji(result.healthScore)}\n`;
		report += `Scan Duration:          ${(result.scanDuration / 1000).toFixed(2)}s\n`;
		report += `Database Scan ID:       ${result.scanId}\n`;
		report += '\n';

		if (result.brokenLinksWithAI.length > 0) {
			report += `🔴 BROKEN LINKS WITH AI ANALYSIS\n`;
			report += `${'─'.repeat(80)}\n\n`;

			// Sort by priority score (highest first)
			const sortedLinks = [...result.brokenLinksWithAI].sort(
				(a, b) => b.aiAnalysis.priorityScore - a.aiAnalysis.priorityScore,
			);

			for (let i = 0; i < sortedLinks.length; i++) {
				const link = sortedLinks[i];
				const analysis = link.aiAnalysis;

				report += `[${i + 1}] ${link.url}\n`;
				report += `    Status: ${link.statusCode || 'Unknown'} | Priority: ${analysis.priorityScore}/100 | Importance: ${analysis.importance.toUpperCase()}\n`;
				report += `    Found On: ${link.foundOn}\n`;
				if (link.linkText) {
					report += `    Link Text: "${link.linkText}"\n`;
				}
				report += `\n`;
				report += `    📍 Intended: ${analysis.intendedDestination}\n`;
				report += `    🎯 Purpose: ${analysis.linkPurpose}\n`;
				report += `    💼 Business Impact: ${analysis.businessImpact}\n`;
				report += `    💡 Reasoning: ${analysis.reasoning}\n`;

				if (analysis.suggestedFixes.length > 0) {
					report += `\n    🔧 Suggested Fixes:\n`;
					for (const fix of analysis.suggestedFixes) {
						report += `       • ${fix}\n`;
					}
				}

				report += '\n';
			}
		} else {
			report += `✅ NO BROKEN LINKS FOUND!\n`;
			report += `All ${result.totalLinks} links are working perfectly.\n\n`;
		}

		report += `${'═'.repeat(80)}\n`;
		report += `Powered by LinXup - AI-Powered Link Monitoring\n`;
		report += `${'═'.repeat(80)}\n`;

		return report;
	}

	/**
	 * Get health score emoji
	 */
	private getHealthEmoji(score: number): string {
		if (score >= 95) return '🟢';
		if (score >= 80) return '🟡';
		if (score >= 60) return '🟠';
		return '🔴';
	}
}
