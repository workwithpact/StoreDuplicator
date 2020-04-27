const Shopify = require('shopify-api-node');

class Migrator {
  constructor(sourceStore, destinationStore, verbosity = 4) {
    this.config = {
      source: sourceStore,
      destination: destinationStore
    }
    this.verbosity = verbosity
    this.source = new Shopify(sourceStore);
    this.destination = new Shopify(destinationStore);
    this.requiredScopes = {
      source: [ // For source, we only need read access, but won't discriminate against write access.
        ['read_content', 'write_content'], // Blogs, Articles, Pages
        ['read_products', 'write_products'], // Products, Variants, Collections
      ],
      destination: [ // Destionation obviously requires write access
        ['write_content'], // Blogs, Articles, Pages
        ['write_products'], // Products, Variants, Collections
      ]
    };
  }
  info() {
    if (this.verbosity > 3) {
      console.info.apply(this, arguments)
    }
  }
  log() {
    if (this.verbosity > 2) {
      console.log.apply(this, arguments)
    }
  }
  warn() {
    if (this.verbosity > 1) {
      console.warn.apply(this, arguments)
    }
  }
  error() {
    console.error.apply(this, arguments)
  }
  async testConnection() {
    const sourceScopes = await this.source.accessScope.list()
    const destinationScopes = await this.destination.accessScope.list()
    this.requiredScopes.source.forEach((scopes) => {
      const scopeFound = !!sourceScopes.find(scope => scopes.indexOf(scope.handle) !== -1)
      if (!scopeFound) {
        const message = `Source store does not have proper access scope: ${scopes[0]}`
        this.error(message)
        throw new Error(message)
      }
    })
    this.requiredScopes.destination.forEach((scopes) => {
      const scopeFound = !!destinationScopes.find(scope => scopes.indexOf(scope.handle) !== -1)
      if (!scopeFound) {
        const message = `Destination store does not have proper access scope: ${scopes[0]}`
        this.error(message)
        throw new Error(message)
      }
    })
  }
  async asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }
  async _getMetafields(resource = null, id = null) {
    let params = { limit: 250 }
    if (resource && id) {
      params.metafield = {
        owner_resource: resource,
        owner_id: id
      }
    }
    const metafields = []
    do {
      const resourceMetafields = await this.source.metafield.list(params)
      resourceMetafields.forEach(m => metafields.push(m))
      params = resourceMetafields.nextPageParameters;
    } while (params !== undefined);
    return metafields
  }
  async _migratePage(page) {
    this.info(`[PAGE ${page.id}] ${page.handle} started...`)
    const metafields = await this._getMetafields('page', page.id)
    this.info(`[PAGE ${page.id}] has ${metafields.length} metafields...`)
    const newPage = await this.destination.page.create(page)
    this.info(`[PAGE ${page.id}] duplicated. New id is ${newPage.id}.`)
    await this.asyncForEach(metafields, async (metafield) => {
      delete metafield.id
      metafield.owner_resource = 'page'
      metafield.owner_id = newPage.id
      this.info(`[PAGE ${page.id}] Metafield ${metafield.namespace}.${metafield.key} started`)
      await this.destination.metafield.create(metafield)
      this.info(`[PAGE ${page.id}] Metafield ${metafield.namespace}.${metafield.key} done!`)
    })
  }
  async migratePages(deleteFirst = false) {
    this.log('Page migration started...')
    let params = { limit: 250 }
    const destinationPages = {}
    if (deleteFirst) {
      this.log('Deletion requested... Gathering all of the destination pages first to avoid duplicates.')
      do {
        const pages = await this.destination.page.list(params)
        await this.asyncForEach(pages, async (page) => {
          destinationPages[page.handle] = page.id
        })
        params = pages.nextPageParameters;
      } while (params !== undefined);
    }
    params = { limit: 250 }
    do {
      const pages = await this.source.page.list(params)
      await this.asyncForEach(pages, async (page) => {
        if (destinationPages[page.handle]) {
          this.log(`[DUPLICATE PAGE] Deleting destination page ${page.handle}`)
          await this.destination.page.delete(destinationPages[page.handle])
        }
        await this._migratePage(page)
      })
      params = pages.nextPageParameters;
    } while (params !== undefined);
    this.log('Page migration finished!')
  }
  async migrateBlogs() {

  }
}

module.exports = Migrator