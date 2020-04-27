const Shopify = require('shopify-api-node');

class Migrator {
  constructor(sourceStore, destinationStore) {
    this.config = {
      source: sourceStore,
      destination: destinationStore
    }
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
  async testConnection() {
    const sourceScopes = await this.source.accessScope.list()
    const destinationScopes = await this.destination.accessScope.list()
    this.requiredScopes.source.forEach((scopes) => {
      const scopeFound = !!sourceScopes.find(scope => scopes.indexOf(scope.handle) !== -1)
      if (!scopeFound) {
        throw new Error(`Source store does not have proper access scope: ${scopes[0]}`)
      }
    })
    this.requiredScopes.destination.forEach((scopes) => {
      const scopeFound = !!destinationScopes.find(scope => scopes.indexOf(scope.handle) !== -1)
      if (!scopeFound) {
        throw new Error(`Destination store does not have proper access scope: ${scopes[0]}`)
      }
    })
  }
}

module.exports = Migrator