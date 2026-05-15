import { Pool } from './node_modules/.pnpm/pg@8.20.0/node_modules/pg/index.js';
import { drizzle } from './node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.18.0_pg@8.20.0/node_modules/drizzle-orm/node-postgres/index.js';
import { pgTable, varchar } from './node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.18.0_pg@8.20.0/node_modules/drizzle-orm/pg-core/index.js';
const pool = new Pool({ connectionString: 'postgres://invalid:5432/invalid', max: 1 });
const organizationsTable = pgTable('organizations', {
  id: varchar('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique(),
  ownerId: varchar('owner_id').notNull(),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
});
const db = drizzle(pool, { schema: { organizationsTable }});
const q = db.insert(organizationsTable).values({ name:'Test', slug:'test', ownerId:'me' });
console.log('toSQL:', typeof q.toSQL === 'function');
try { console.log(q.toSQL()); } catch (err) { console.error('toSQL error', err); }
pool.end();
