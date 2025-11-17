/**
 * Database Connection Test Script
 * Run this to verify PostgreSQL connection and database operations
 *
 * Usage:
 *   npm run build && node build/test-db.js
 */

import * as dotenv from 'dotenv';
import { createDatabase, User, Website } from './persistence/database.js';

// Load environment variables
dotenv.config();

async function testDatabase() {
  console.log('🔍 LinXup Database Connection Test\n');
  console.log('==========================================');

  try {
    // Create database instance
    console.log('📊 Creating database connection...');
    const db = createDatabase();

    // Test connection
    console.log('\n1️⃣ Testing database connection...');
    const isConnected = await db.testConnection();

    if (!isConnected) {
      console.error('❌ Connection test failed');
      process.exit(1);
    }

    // Test: Get all users
    console.log('\n2️⃣ Fetching all users...');
    const users = await db.query<User>('SELECT * FROM users');
    console.log(`✅ Found ${users.rowCount} user(s):`);
    users.rows.forEach((user: User) => {
      console.log(`   - ${user.name} (${user.email}) - Plan: ${user.plan_tier}`);
    });

    // Test: Get user by email
    console.log('\n3️⃣ Testing getUserByEmail...');
    const user = await db.getUserByEmail('pilot@alaskaimpactalliance.org');
    if (user) {
      console.log('✅ User found:', user.name);
    } else {
      console.log('❌ User not found');
    }

    // Test: Get websites for user
    console.log('\n4️⃣ Fetching websites for user...');
    if (user) {
      const websites = await db.getWebsitesByUserId(user.id);
      console.log(`✅ Found ${websites.length} website(s):`);
      websites.forEach((website: Website) => {
        console.log(`   - ${website.name}: ${website.url}`);
        console.log(`     Scan frequency: ${website.scan_frequency}`);
      });

      // Test: Create a test scan
      if (websites.length > 0) {
        console.log('\n5️⃣ Creating test scan result...');
        const scan = await db.createScanResult(websites[0].id, 'manual', user.id);
        console.log(`✅ Scan created with ID: ${scan.id}`);
        console.log(`   Status: ${scan.status}`);
        console.log(`   Started at: ${scan.started_at}`);

        // Test: Create a test broken link
        console.log('\n6️⃣ Creating test broken link...');
        const brokenLink = await db.createBrokenLink(
          scan.id,
          'https://example.com/broken-page',
          404,
          'https://example.com/homepage',
          'Click here for more info',
          '<a href="/broken-page">Click here for more info</a>'
        );
        console.log(`✅ Broken link created with ID: ${brokenLink.id}`);
        console.log(`   URL: ${brokenLink.url}`);
        console.log(`   Status code: ${brokenLink.status_code}`);
        console.log(`   Found on: ${brokenLink.found_on}`);

        // Test: Update broken link with AI analysis (simulated)
        console.log('\n7️⃣ Updating broken link with AI analysis...');
        const aiAnalysis = {
          intendedDestination: 'Information page about services',
          linkPurpose: 'Navigate to detailed service description',
          importance: 'Medium - informational content',
          reasoning: 'This appears to be a navigation link to a service page',
          businessImpact: 'May confuse users looking for service details'
        };
        const suggestedFixes = [
          {
            url: 'https://example.com/services',
            source: 'gpt4' as const,
            confidence: 0.85,
            reasoning: 'Similar page found in site structure'
          },
          {
            url: 'https://web.archive.org/web/20231201000000/https://example.com/broken-page',
            source: 'wayback' as const,
            confidence: 0.95,
            reasoning: 'Archived version available'
          }
        ];

        const updatedLink = await db.updateBrokenLinkWithAI(
          brokenLink.id,
          aiAnalysis,
          suggestedFixes,
          65, // priority score
          false // not critical
        );

        console.log('✅ AI analysis added successfully');
        console.log('   Priority score:', updatedLink.priority_score);
        console.log('   Analysis:', updatedLink.ai_analysis);
        console.log('   Suggested fixes:', updatedLink.suggested_fixes);

        // Test: Complete the scan
        console.log('\n8️⃣ Completing scan...');
        const completedScan = await db.completeScanResult(
          scan.id,
          247, // total links
          1,   // broken links
          99   // health score
        );
        console.log('✅ Scan completed');
        console.log(`   Total links: ${completedScan.total_links}`);
        console.log(`   Broken links: ${completedScan.broken_links}`);
        console.log(`   Health score: ${completedScan.health_score}/100`);
        console.log(`   Completed at: ${completedScan.completed_at}`);

        // Test: Get alert preferences
        console.log('\n9️⃣ Fetching alert preferences...');
        const alertPrefs = await db.getAlertPreferences(websites[0].id);
        if (alertPrefs) {
          console.log('✅ Alert preferences found:');
          console.log(`   Alert on new broken: ${alertPrefs.alert_on_new_broken}`);
          console.log(`   Alert on fixed: ${alertPrefs.alert_on_fixed}`);
          console.log(`   Recipients: ${alertPrefs.email_recipients.join(', ')}`);
        }
      }
    }

    console.log('\n==========================================');
    console.log('✅ All database tests passed successfully!');
    console.log('==========================================\n');

    // Close database connection
    await db.close();

  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDatabase();
