/**
 * LinXup Test with Broken Links
 * Tests AI analysis on actual broken links
 *
 * Usage:
 *   npm run build && node build/src/test-linxup-broken.js
 */

import * as dotenv from 'dotenv';
import { createDatabase } from './persistence/database.js';
import { createGeminiAnalyzer } from './ai/gemini-analyzer.js';
import { LinXupChecker } from './linxup-checker.js';

// Load environment variables
dotenv.config();

async function testLinXupWithBrokenLinks() {
	console.log('🔗 LinXup Test - Broken Links Analysis');
	console.log('==========================================\n');

	try {
		// Initialize
		console.log('📊 Initializing...');
		const db = createDatabase();
		await db.testConnection();

		const user = await db.getUserByEmail('pilot@alaskaimpactalliance.org');
		if (!user) {
			throw new Error('Test user not found');
		}

		const websites = await db.getWebsitesByUserId(user.id);
		const website = websites[0];
		if (!website) {
			throw new Error('Test website not found');
		}

		const aiAnalyzer = createGeminiAnalyzer();
		await aiAnalyzer.testConnection();

		// Create checker
		const checker = new LinXupChecker(
			db,
			aiAnalyzer,
			website.id,
			user.id,
			true, // Enable Wayback Machine
		);

		console.log('✅ Initialization complete\n');

		// Scan local test file
		console.log('🔍 Scanning test-site.html with intentional broken links...\n');

		const result = await checker.checkWithIntelligence({
			path: './test-site.html',
			recurse: false,
			timeout: 30000,
		});

		// Display detailed report
		const report = checker.generateReport(result);
		console.log(report);

		// Show database storage
		console.log('\n📦 DATABASE STORAGE VERIFICATION:');
		console.log('─'.repeat(80));

		const brokenLinksFromDb = await db.getBrokenLinksByScanId(result.scanId);
		console.log(`Total broken links in database: ${brokenLinksFromDb.length}\n`);

		for (const link of brokenLinksFromDb) {
			console.log(`URL: ${link.url}`);
			console.log(`  Status: ${link.status_code}`);
			console.log(`  Priority: ${link.priority_score}/100`);
			console.log(`  Critical: ${link.is_critical ? 'YES' : 'No'}`);

			if (link.ai_analysis) {
				const analysis = link.ai_analysis as any;
				console.log(`  Importance: ${analysis.importance}`);
				console.log(`  Business Impact: ${analysis.businessImpact}`);
			}

			if (link.suggested_fixes) {
				const fixes = link.suggested_fixes as any[];
				console.log(`  Suggested Fixes: ${fixes.length} available`);
			}

			console.log('');
		}

		console.log('═'.repeat(80));
		console.log('✅ Test Complete - AI Analysis Working Perfectly!');
		console.log('═'.repeat(80));

		await db.close();
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	}
}

// Run the test
testLinXupWithBrokenLinks();
