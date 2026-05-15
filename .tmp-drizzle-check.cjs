const { Pool } = require('./node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js');
const { drizzle } = require('./node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.18.0_pg@8.20.0/node_modules/drizzle-orm/node-postgres/index.cjs');
const { pgTable, varchar, text, real, integer, timestamp } = require('./node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.18.0_pg@8.20.0/node_modules/drizzle-orm/pg-core/index.cjs');
const { sql } = require('./node_modules/.pnpm/drizzle-orm@0.45.2_@types+pg@8.18.0_pg@8.20.0/node_modules/drizzle-orm/index.cjs');
const pool = new Pool({ connectionString: 'postgres://invalid:5432/invalid', max: 1 });
const organizationsTable = pgTable('organizations', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique(),
  logoUrl: text('logo_url'),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
  ownerId: varchar('owner_id').notNull(),
  creditsBalance: real('credits_balance').notNull().default(100),
  stripeCustomerId: varchar('stripe_customer_id'),
  stripeSubscriptionId: varchar('stripe_subscription_id'),
  seats: integer('seats').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
const db = drizzle(pool, { schema: { organizationsTable }});
const q = db.insert(organizationsTable).values({ name:'Test', slug:'test', plan:'free', ownerId:'me' }).returning();
console.log(q.toSQL());
pool.end();
