require('dotenv').config()
const { program } = require('commander');
const Migrator = require('./src/migrator.js')

program.version('1.0.0');
program
  .option('--all', 'Migrate everything')
  .option('--metafields', 'Run the migration for shop\'s metafields')
  .option('--delete-metafields', 'Delete(replace) shop metafields with the same namespace and key')
  .option('--products', 'Run the migration for products')
  .option('--delete-products', 'Delete(replace) products with the same handles')
  .option('--collections', 'Run the migration for collections')
  .option('--delete-collections', 'Delete(replace) collections with the same handles')
  .option('--articles', 'Run the migration for articles')
  .option('--delete-articles', 'Delete(replace) articles with the same handles')
  .option('--blogs', 'Run the migration for blogs')
  .option('--delete-blogs', 'Delete(replace) with the same handles')
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
    migration.log('Store configuration looks correct.')
  } catch (e) {
    migration.error('Could not validate proper store setup', e.message)
    process.exit()
  }
  if (program.all || program.pages) {
    await migration.migratePages(program.deletePages)
  }
  if (program.all || program.blogs) {
    await migration.migrateBlogs(program.deleteBlogs)
  }
  if (program.all || program.articles) {
    await migration.migrateArticles(program.deleteArticles)
  }
  if (program.all || program.products) {
    await migration.migrateProducts(program.deleteProducts)
  }
  if (program.all || program.collections) {
    await migration.migrateSmartCollections(program.deleteCollections)
    await migration.migrateCustomCollections(program.deleteCollections)
  }
  if (program.all || program.metafields) {
    await migration.migrateMetafields(program.deleteMetafields)
  }
}
start()