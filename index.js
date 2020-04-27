require('dotenv').config()
const { program } = require('commander');
const Migrator = require('./src/migrator.js')

program.version('1.0.0');
program
  .option('--products', 'Run the migration for products')
  .option('--articles', 'Run the migration for articles')
  .option('--collections', 'Run the migration for collections')
  .option('--pages', 'Run the migration for pages')

program.parse(process.argv);

const start = async () => {
  const sourceStore = {
    shopName: process.env.SOURCE_SHOPIFY_STORE,
    apiKey: process.env.SOURCE_SHOPIFY_API_KEY,
    password: process.env.SOURCE_SHOPIFY_API_PASSWORD,
  }
  const destinationStore = {
    shopName: process.env.DESTINATION_SHOPIFY_STORE,
    apiKey: process.env.DESTINATION_SHOPIFY_API_KEY,
    password: process.env.DESTINATION_SHOPIFY_API_PASSWORD,
  }
  const migration = new Migrator(sourceStore, destinationStore)
  await migration.testConnection()
}
start()