require('dotenv').config()
const { program } = require('commander');
const Migrator = require('./src/migrator.js')

program.version('1.0.0');
program
  .option('--products', 'Run the migration for products')
  .option('--articles', 'Run the migration for articles')
  .option('--collections', 'Run the migration for collections')
  .option('--pages', 'Run the migration for pages')
  .option('--delete-pages', 'Delete(replace) pages with the same handles')
  .option('-v, --verbosity', 'Verbosity level. Defaults to 4, as talkative as my MIL.')

program.parse(process.argv);

const start = async () => {
  const sourceStore = {
    shopName: process.env.SOURCE_SHOPIFY_STORE,
    apiKey: process.env.SOURCE_SHOPIFY_API_KEY,
    password: process.env.SOURCE_SHOPIFY_API_PASSWORD,
    apiVersion: '2020-04'
  }
  const destinationStore = {
    shopName: process.env.DESTINATION_SHOPIFY_STORE,
    apiKey: process.env.DESTINATION_SHOPIFY_API_KEY,
    password: process.env.DESTINATION_SHOPIFY_API_PASSWORD,
    apiVersion: '2020-04'
  }
  const migration = new Migrator(sourceStore, destinationStore, (program.verbosity && program.verbosity * 1)|| 4)
  try {
    await migration.testConnection()
    console.log('Store configuration looks correct.')
  } catch (e) {
    console.log('Could not validate proper store setup', e.message)
    process.exit()
  }
  if (program.pages) {
    await migration.migratePages(program.deletePages)
  }
}
start()