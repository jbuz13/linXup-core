/**
 * LinXup Database Connection Module
 * PostgreSQL connection pool and database operations
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

/**
 * Database configuration interface
 */
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * User model from database
 */
export interface User {
  id: number;
  email: string;
  name: string;
  organization: string | null;
  plan_tier: 'free' | 'basic' | 'pro' | 'enterprise';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Website model from database
 */
export interface Website {
  id: number;
  user_id: number;
  name: string;
  url: string;
  scan_frequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  scan_day_of_week: number | null;
  scan_hour: number;
  last_scanned_at: Date | null;
  next_scan_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Scan result model from database
 */
export interface ScanResult {
  id: number;
  website_id: number;
  scan_type: 'scheduled' | 'manual';
  triggered_by: number | null;
  started_at: Date;
  completed_at: Date | null;
  total_links: number;
  broken_links: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  health_score: number | null;
  error_message: string | null;
  created_at: Date;
}

/**
 * Broken link model from database
 */
export interface BrokenLink {
  id: number;
  scan_id: number;
  url: string;
  status_code: number | null;
  found_on: string;
  link_text: string | null;
  html_context: string | null;
  ai_analysis: AIAnalysis | null;
  suggested_fixes: SuggestedFix[] | null;
  priority_score: number | null;
  is_critical: boolean;
  first_detected_at: Date;
  created_at: Date;
}

/**
 * AI Analysis structure (stored as JSONB)
 */
export interface AIAnalysis {
  intendedDestination?: string;
  linkPurpose?: string;
  importance?: string;
  reasoning?: string;
  businessImpact?: string;
}

/**
 * Suggested fix structure (stored as JSONB array)
 */
export interface SuggestedFix {
  url: string;
  source: 'wayback' | 'gpt4' | 'similar_page';
  confidence: number;
  reasoning?: string;
}

/**
 * Alert preferences model from database
 */
export interface AlertPreferences {
  id: number;
  website_id: number;
  alert_on_new_broken: boolean;
  alert_on_fixed: boolean;
  alert_weekly_summary: boolean;
  alert_critical_only: boolean;
  digest_mode: boolean;
  email_recipients: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Database class for managing PostgreSQL connections and queries
 */
export class Database {
  private pool: Pool;
  private static instance: Database;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.max || 20,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  /**
   * Get or create database instance (singleton)
   */
  public static getInstance(config?: DatabaseConfig): Database {
    if (!Database.instance) {
      if (!config) {
        throw new Error('Database configuration required for first initialization');
      }
      Database.instance = new Database(config);
    }
    return Database.instance;
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Database connection successful:', result.rows[0].now);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  /**
   * Execute a query
   */
  public async query<T extends QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;
      console.log('Executed query:', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Query error:', { text, error });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  /**
   * Close all database connections
   */
  public async close(): Promise<void> {
    await this.pool.end();
    console.log('Database connections closed');
  }

  // ============================================================================
  // USER OPERATIONS
  // ============================================================================

  /**
   * Get user by ID
   */
  public async getUserById(id: number): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get user by email
   */
  public async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new user
   */
  public async createUser(
    email: string,
    name: string,
    organization?: string,
    planTier: 'free' | 'basic' | 'pro' | 'enterprise' = 'free'
  ): Promise<User> {
    const result = await this.query<User>(
      `INSERT INTO users (email, name, organization, plan_tier)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, name, organization, planTier]
    );
    return result.rows[0];
  }

  // ============================================================================
  // WEBSITE OPERATIONS
  // ============================================================================

  /**
   * Get website by ID
   */
  public async getWebsiteById(id: number): Promise<Website | null> {
    const result = await this.query<Website>(
      'SELECT * FROM websites WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all websites for a user
   */
  public async getWebsitesByUserId(userId: number): Promise<Website[]> {
    const result = await this.query<Website>(
      'SELECT * FROM websites WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  /**
   * Create a new website
   */
  public async createWebsite(
    userId: number,
    name: string,
    url: string,
    scanFrequency: 'manual' | 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<Website> {
    const result = await this.query<Website>(
      `INSERT INTO websites (user_id, name, url, scan_frequency)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, name, url, scanFrequency]
    );
    return result.rows[0];
  }

  // ============================================================================
  // SCAN OPERATIONS
  // ============================================================================

  /**
   * Create a new scan result
   */
  public async createScanResult(
    websiteId: number,
    scanType: 'scheduled' | 'manual',
    triggeredBy?: number
  ): Promise<ScanResult> {
    const result = await this.query<ScanResult>(
      `INSERT INTO scan_results (website_id, scan_type, triggered_by, status)
       VALUES ($1, $2, $3, 'running')
       RETURNING *`,
      [websiteId, scanType, triggeredBy || null]
    );
    return result.rows[0];
  }

  /**
   * Update scan result when completed
   */
  public async completeScanResult(
    scanId: number,
    totalLinks: number,
    brokenLinks: number,
    healthScore: number
  ): Promise<ScanResult> {
    const result = await this.query<ScanResult>(
      `UPDATE scan_results
       SET completed_at = NOW(),
           total_links = $2,
           broken_links = $3,
           health_score = $4,
           status = 'completed'
       WHERE id = $1
       RETURNING *`,
      [scanId, totalLinks, brokenLinks, healthScore]
    );
    return result.rows[0];
  }

  /**
   * Get latest scan for a website
   */
  public async getLatestScan(websiteId: number): Promise<ScanResult | null> {
    const result = await this.query<ScanResult>(
      `SELECT * FROM scan_results
       WHERE website_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [websiteId]
    );
    return result.rows[0] || null;
  }

  // ============================================================================
  // BROKEN LINK OPERATIONS
  // ============================================================================

  /**
   * Create a broken link record
   */
  public async createBrokenLink(
    scanId: number,
    url: string,
    statusCode: number | null,
    foundOn: string,
    linkText?: string,
    htmlContext?: string
  ): Promise<BrokenLink> {
    const result = await this.query<BrokenLink>(
      `INSERT INTO broken_links (scan_id, url, status_code, found_on, link_text, html_context)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [scanId, url, statusCode, foundOn, linkText || null, htmlContext || null]
    );
    return result.rows[0];
  }

  /**
   * Update broken link with AI analysis
   */
  public async updateBrokenLinkWithAI(
    linkId: number,
    aiAnalysis: AIAnalysis,
    suggestedFixes: SuggestedFix[],
    priorityScore: number,
    isCritical: boolean
  ): Promise<BrokenLink> {
    const result = await this.query<BrokenLink>(
      `UPDATE broken_links
       SET ai_analysis = $2,
           suggested_fixes = $3,
           priority_score = $4,
           is_critical = $5
       WHERE id = $1
       RETURNING *`,
      [linkId, JSON.stringify(aiAnalysis), JSON.stringify(suggestedFixes), priorityScore, isCritical]
    );
    return result.rows[0];
  }

  /**
   * Get all broken links for a scan
   */
  public async getBrokenLinksByScanId(scanId: number): Promise<BrokenLink[]> {
    const result = await this.query<BrokenLink>(
      `SELECT * FROM broken_links
       WHERE scan_id = $1
       ORDER BY priority_score DESC NULLS LAST`,
      [scanId]
    );
    return result.rows;
  }

  // ============================================================================
  // ALERT PREFERENCES OPERATIONS
  // ============================================================================

  /**
   * Get alert preferences for a website
   */
  public async getAlertPreferences(websiteId: number): Promise<AlertPreferences | null> {
    const result = await this.query<AlertPreferences>(
      'SELECT * FROM alert_preferences WHERE website_id = $1',
      [websiteId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create or update alert preferences
   */
  public async upsertAlertPreferences(
    websiteId: number,
    preferences: Partial<AlertPreferences>
  ): Promise<AlertPreferences> {
    const result = await this.query<AlertPreferences>(
      `INSERT INTO alert_preferences (
        website_id, alert_on_new_broken, alert_on_fixed,
        alert_weekly_summary, alert_critical_only, digest_mode, email_recipients
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (website_id) DO UPDATE SET
        alert_on_new_broken = EXCLUDED.alert_on_new_broken,
        alert_on_fixed = EXCLUDED.alert_on_fixed,
        alert_weekly_summary = EXCLUDED.alert_weekly_summary,
        alert_critical_only = EXCLUDED.alert_critical_only,
        digest_mode = EXCLUDED.digest_mode,
        email_recipients = EXCLUDED.email_recipients,
        updated_at = NOW()
      RETURNING *`,
      [
        websiteId,
        preferences.alert_on_new_broken ?? true,
        preferences.alert_on_fixed ?? true,
        preferences.alert_weekly_summary ?? false,
        preferences.alert_critical_only ?? false,
        preferences.digest_mode ?? false,
        preferences.email_recipients || []
      ]
    );
    return result.rows[0];
  }
}

/**
 * Create and export default database instance
 * Configuration will be loaded from environment variables
 */
export function createDatabase(config?: DatabaseConfig): Database {
  const dbConfig: DatabaseConfig = config || {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'linxup_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DB_POOL_MAX || '20'),
  };

  return Database.getInstance(dbConfig);
}
