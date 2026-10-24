import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const profiles = sqliteTable('profiles', {
  userId: text('user_id').primaryKey(),
  state: text('state').notNull(),
  revision: integer('revision').notNull().default(0),
})

// Ciphertext only. AES-256-GCM, bound to the authenticated Site user id by garmin-vault.mjs.
// The encryption key is a hosted runtime secret and is never stored in this database.
export const credentials = sqliteTable('credentials', {
  userId: text('user_id').primaryKey(),
  encryptedGarminKey: text('encrypted_garmin_key').notNull(),
  lastPull: integer('last_pull').notNull().default(0),
})
