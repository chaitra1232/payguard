import fs from 'fs';
import path from 'path';
import { pool, query } from '../config/database';

async function runMigrations() {
  console.log('🚀 Running PayGuard database migrations...');
  try {
    // Create migrations tracker table if not exists
    await query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const alreadyApplied = await query(
        'SELECT filename FROM schema_migrations WHERE filename = $1',
        [file]
      );

      if (alreadyApplied.rows.length === 0) {
        console.log(`⏳ Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`✅ Applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`❌ Migration failed in ${file}:`, err);
          throw err;
        } finally {
          client.release();
        }
      } else {
        console.log(`⏭️  Skipping already applied migration: ${file}`);
      }
    }

    console.log('🎉 All migrations applied successfully!');
  } catch (err) {
    console.error('❌ Migration process failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
