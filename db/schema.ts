import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const experiments=sqliteTable('experiments',{userId:text('user_id').primaryKey(),revision:integer('revision').notNull().default(0),body:text('body').notNull()});
