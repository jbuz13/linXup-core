/**
 * Gemini AI Link Analyzer Test Script
 * Tests the GeminiLinkAnalyzer with 5 sample broken links
 *
 * Usage:
 *   npm run build && node build/src/test-gemini.js
 */

import * as dotenv from 'dotenv';
import {
	createGeminiAnalyzer,
	type BrokenLinkInput,
} from './ai/gemini-analyzer.js';

// Load environment variables
dotenv.config();

// Sample broken links for testing
const sampleBrokenLinks: BrokenLinkInput[] = [
	{
		brokenUrl: 'https://alaskaimpactalliance.org/donate-now',
		statusCode: 404,
		foundOnUrl: 'https://alaskaimpactalliance.org/',
		foundOnTitle: 'Alaska Impact Alliance - Home',
		linkText: 'Donate Now',
		htmlContext:
			'<a href="/donate-now" class="btn btn-primary">Donate Now</a>',
		surroundingText:
			'Support our mission to help Alaska nonprofits thrive. Donate Now to make a difference.',
	},
	{
		brokenUrl: 'https://alaskaimpactalliance.org/programs/youth-services',
		statusCode: 404,
		foundOnUrl: 'https://alaskaimpactalliance.org/programs',
		foundOnTitle: 'Our Programs',
		linkText: 'Youth Services Program',
		htmlContext:
			'<a href="/programs/youth-services">Youth Services Program</a>',
		surroundingText:
			'Learn more about our Youth Services Program which helps young Alaskans develop leadership skills.',
	},
	{
		brokenUrl: 'https://alaskaimpactalliance.org/contact-us',
		statusCode: 500,
		foundOnUrl: 'https://alaskaimpactalliance.org/',
		foundOnTitle: 'Alaska Impact Alliance - Home',
		linkText: 'Contact Us',
		htmlContext: '<a href="/contact-us">Contact Us</a>',
		surroundingText:
			'Have questions? Contact Us to speak with our team.',
	},
	{
		brokenUrl:
			'https://alaskaimpactalliance.org/blog/2019/archived-post.html',
		statusCode: 404,
		foundOnUrl: 'https://alaskaimpactalliance.org/blog',
		foundOnTitle: 'Blog Archive',
		linkText: 'Read our 2019 annual report',
		htmlContext:
			'<a href="/blog/2019/archived-post.html">Read our 2019 annual report</a>',
		surroundingText:
			'Historical content from 2019. Read our 2019 annual report for past achievements.',
	},
	{
		brokenUrl: 'https://alaskaimpactalliance.org/resources/toolkit.pdf',
		statusCode: 404,
		foundOnUrl: 'https://alaskaimpactalliance.org/resources',
		foundOnTitle: 'Resources',
		linkText: 'Download Nonprofit Toolkit (PDF)',
		htmlContext:
			'<a href="/resources/toolkit.pdf" download>Download Nonprofit Toolkit (PDF)</a>',
		surroundingText:
			'Free resources for Alaska nonprofits. Download Nonprofit Toolkit (PDF) with best practices.',
	},
];

async function testGeminiAnalyzer() {
	console.log('🔍 LinXup Gemini AI Analyzer Test\n');
	console.log('==========================================');

	try {
		// Create analyzer
		console.log('🤖 Creating Gemini analyzer...');
		const analyzer = createGeminiAnalyzer();
		console.log('✅ Analyzer created successfully\n');

		// Test connection
		console.log('1️⃣ Testing Gemini API connection...');
		const isConnected = await analyzer.testConnection();

		if (!isConnected) {
			console.error('❌ Connection test failed');
			process.exit(1);
		}
		console.log('');

		// Analyze each broken link
		console.log(
			`2️⃣ Analyzing ${sampleBrokenLinks.length} sample broken links...\n`,
		);

		for (let i = 0; i < sampleBrokenLinks.length; i++) {
			const link = sampleBrokenLinks[i];
			console.log(`\n${'='.repeat(80)}`);
			console.log(`BROKEN LINK #${i + 1}`);
			console.log(`${'='.repeat(80)}`);
			console.log(`URL: ${link.brokenUrl}`);
			console.log(`Status: ${link.statusCode}`);
			console.log(`Link Text: "${link.linkText}"`);
			console.log(`Found On: ${link.foundOnUrl}`);
			console.log('\n⏳ Analyzing with Gemini AI...\n');

			try {
				const analysis = await analyzer.analyzeContext(link);

				console.log('✅ ANALYSIS RESULTS:');
				console.log('─'.repeat(80));
				console.log(`📍 Intended Destination: ${analysis.intendedDestination}`);
				console.log(`🎯 Link Purpose: ${analysis.linkPurpose}`);
				console.log(
					`⚠️  Importance: ${analysis.importance.toUpperCase()} (Priority: ${analysis.priorityScore}/100)`,
				);
				console.log(`💼 Business Impact: ${analysis.businessImpact}`);
				console.log(`💡 Reasoning: ${analysis.reasoning}`);

				if (analysis.suggestedFixes.length > 0) {
					console.log('\n🔧 Suggested Fixes:');
					analysis.suggestedFixes.forEach((fix, idx) => {
						console.log(`   ${idx + 1}. ${fix}`);
					});
				} else {
					console.log('\n🔧 Suggested Fixes: None provided');
				}

				console.log('');
			} catch (error) {
				console.error(`❌ Analysis failed:`, error);
			}

			// Rate limiting: wait between requests
			if (i < sampleBrokenLinks.length - 1) {
				console.log('\n⏸  Waiting 2 seconds before next request...');
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}

		console.log('\n' + '='.repeat(80));
		console.log('✅ All tests completed successfully!');
		console.log('='.repeat(80));
		console.log('\n📊 SUMMARY:');
		console.log(`   - Total links analyzed: ${sampleBrokenLinks.length}`);
		console.log('   - Gemini model: gemini-2.0-flash');
		console.log('   - API calls made: ' + (sampleBrokenLinks.length + 1));
		console.log(
			`   - Remaining free tier: ~${1500 - (sampleBrokenLinks.length + 1)} requests today`,
		);
		console.log('\n');
	} catch (error) {
		console.error('\n❌ Test failed:', error);
		process.exit(1);
	}
}

// Run the test
testGeminiAnalyzer();
