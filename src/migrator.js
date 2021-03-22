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

  async _migrateBlog(blog) {
    this.info(`[BLOG ${blog.id}] ${blog.handle} started...`)
    const metafields = await this._getMetafields('blog', blog.id)
    this.info(`[BLOG ${blog.id}] has ${metafields.length} metafields...`)
    const newBlog = await this.destination.blog.create(blog)
    this.info(`[BLOG ${blog.id}] duplicated. New id is ${newBlog.id}.`)
    await this.asyncForEach(metafields, async (metafield) => {
      delete metafield.id
      metafield.owner_resource = 'blog'
      metafield.owner_id = newBlog.id
      this.info(`[BLOG ${blog.id}] Metafield ${metafield.namespace}.${metafield.key} started`)
      await this.destination.metafield.create(metafield)
      this.info(`[BLOG ${blog.id}] Metafield ${metafield.namespace}.${metafield.key} done!`)
    })
  }

  async _migrateSmartCollection(collection) {
    this.info(`[SMART COLLECTION ${collection.id}] ${collection.handle} started...`)
    const metafields = await this._getMetafields('smart_collection', collection.id)
    this.info(`[SMART COLLECTION ${collection.id}] has ${metafields.length} metafields...`)
    delete collection.publications
    const newCollection = await this.destination.smartCollection.create(collection)
    this.info(`[SMART COLLECTION ${collection.id}] duplicated. New id is ${newCollection.id}.`)
    await this.asyncForEach(metafields, async (metafield) => {
      delete metafield.id
      metafield.owner_resource = 'smart_collection'
      metafield.owner_id = newCollection.id
      this.info(`[SMART COLLECTION ${collection.id}] Metafield ${metafield.namespace}.${metafield.key} started`)
      await this.destination.metafield.create(metafield)
      this.info(`[SMART COLLECTION ${collection.id}] Metafield ${metafield.namespace}.${metafield.key} done!`)
    })
  }

  async _migrateCustomCollection(collection, productMap = {}) {
    this.info(`[CUSTOM COLLECTION ${collection.id}] ${collection.handle} started...`)
    const metafields = await this._getMetafields('custom_collection', collection.id)
    const products = []
    let params = { limit: 250 }
    do {
      const sourceProducts = await this.source.collection.products(collection.id, params)
      sourceProducts.forEach(p => products.push(p))
      params = sourceProducts.nextPageParameters;
    } while (params !== undefined);
    this.info(`[CUSTOM COLLECTION ${collection.id}] has ${products.length} products...`)
    this.info(`[CUSTOM COLLECTION ${collection.id}] has ${metafields.length} metafields...`)
    delete collection.publications
    collection.collects = products.map(p => productMap[p.id] || null).filter(p => p).map((p) => {
      return {
        product_id: p
      }
    })
    const newCollection = await this.destination.customCollection.create(collection)
    this.info(`[CUSTOM COLLECTION ${collection.id}] duplicated. New id is ${newCollection.id}.`)
    await this.asyncForEach(metafields, async (metafield) => {
      delete metafield.id
      metafield.owner_resource = 'custom_collection'
      metafield.owner_id = newCollection.id
      this.info(`[CUSTOM COLLECTION ${collection.id}] Metafield ${metafield.namespace}.${metafield.key} started`)
      await this.destination.metafield.create(metafield)
      this.info(`[CUSTOM COLLECTION ${collection.id}] Metafield ${metafield.namespace}.${metafield.key} done!`)
    })
  }

  async _migrateProduct(product) {
    this.info(`[PRODUCT ${product.id}] ${product.handle} started...`)
    const metafields = await this._getMetafields('product', product.id)
    this.info(`[PRODUCT ${product.id}] has ${metafields.length} metafields...`)
    product.metafields = metafields
    const images = (product.images || []).map(v => v)
    delete product.images;
    (product.variants || []).forEach((variant, i) => {
      if (variant.compare_at_price && (variant.compare_at_price * 1) <= (variant.price * 1)) {
        delete product.variants[i].compare_at_price
      }
      /*reset fulfillment services to shopify*/
      delete variant.fulfillment_service
      variant.inventory_management = 'shopify'
      delete product.variants[i].image_id
    })
    const newProduct = await this.destination.product.create(product)
    this.info(`[PRODUCT ${product.id}] duplicated. New id is ${newProduct.id}.`)
    this.info(`[PRODUCT ${product.id}] Creating ${images && images.length || 0} images...`)
    if (images && images.length) {
      const newImages = images.map((image) => {
        image.product_id = newProduct.id
        image.variant_ids = image.variant_ids.map((oldId) => {
          const oldVariant = product.variants.find(v => v.id === oldId)
          const newVariant = newProduct.variants.find(v => v.title === oldVariant.title)
          return newVariant.id
        })
        return image
      })
      await this.asyncForEach(newImages, async (image) => {
        try {
          await this.destination.productImage.create(newProduct.id, image)
        } catch (e) {
          this.warn(e.message, 'Retrying.')
          await this.destination.productImage.create(newProduct.id, image)
        }
      })
    }
    await this.asyncForEach(metafields, async (metafield) => {
      delete metafield.id
      metafield.owner_resource = 'product'
      metafield.owner_id = newProduct.id
      this.info(`[PRODUCT ${product.id}] Metafield ${metafield.namespace}.${metafield.key} started`)
      await this.destination.metafield.create(metafield)
      this.info(`[PRODUCT ${product.id}] Metafield ${metafield.namespace}.${metafield.key} done!`)
    })
  }

  async _migrateArticle(blogId, article) {
    this.info(`[ARTICLE ${article.id}] ${article.handle} started...`)
    const metafields = await this._getMetafields('article', article.id)
    this.info(`[ARTICLE ${article.id}] has ${metafields.length} metafields...`)
    delete article.user_id
    delete article.created_at
    delete article.deleted_at
    article.blog_id = blogId
    const newArticle = await this.destination.article.create(blogId, article)
    this.info(`[ARTICLE ${article.id}] duplicated. New id is ${newArticle.id}.`)
    await this.asyncForEach(metafields, async (metafield) => {
      delete metafield.id
      metafield.owner_resource = 'article'
      metafield.owner_id = newArticle.id
      this.info(`[ARTICLE ${article.id}] Metafield ${metafield.namespace}.${metafield.key} started`)
      await this.destination.metafield.create(metafield)
      this.info(`[ARTICLE ${article.id}] Metafield ${metafield.namespace}.${metafield.key} done!`)
    })
  }

  async migratePages(deleteFirst = false, skipExisting = true) {
    this.log('Page migration started...')
    let params = { limit: 250 }
    const destinationPages = {}
    do {
      const pages = await this.destination.page.list(params)
      await this.asyncForEach(pages, async (page) => {
        destinationPages[page.handle] = page.id
      })
      params = pages.nextPageParameters;
    } while (params !== undefined);
    params = { limit: 250 }
    do {
      const pages = await this.source.page.list(params)
      await this.asyncForEach(pages, async (page) => {
        if (destinationPages[page.handle] && deleteFirst) {
          this.log(`[DUPLICATE PAGE] Deleting destination page ${page.handle}`)
          await this.destination.page.delete(destinationPages[page.handle])
        }
        if (destinationPages[page.handle] && skipExisting && !deleteFirst) {
          this.log(`[EXISTING PAGE] Skipping ${page.handle}`)
          return
        }
        await this._migratePage(page)
      })
      params = pages.nextPageParameters;
    } while (params !== undefined);
    this.log('Page migration finished!')
  }

  async migrateProducts(deleteFirst = false, skipExisting = true) {
    this.log('Product migration started...')
    let params = { limit: 250 }
    const destinationProducts = {}
    do {
      const products = await this.destination.product.list(params)
      await this.asyncForEach(products, async (product) => {
        destinationProducts[product.handle] = product.id
      })
      params = products.nextPageParameters;
    } while (params !== undefined);
    params = { limit: 250 }
    do {
      const products = await this.source.product.list(params)
      await this.asyncForEach(products, async (product) => {
        if (destinationProducts[product.handle] && deleteFirst) {
          this.log(`[DUPLICATE PRODUCT] Deleting destination product ${product.handle}`)
          await this.destination.product.delete(destinationProducts[product.handle])
        }
        if (destinationProducts[product.handle] && skipExisting && !deleteFirst) {
          this.log(`[EXISTING PRODUCT] Skipping ${product.handle}`)
          return
        }
        try {
          await this._migrateProduct(product)
        } catch (e) {
          this.error(`[PRODUCT] ${product.handle} FAILED TO BE CREATED PROPERLY.`)
        }
      })
      params = products.nextPageParameters;
    } while (params !== undefined);
    this.log('Product migration finished!')
  }
  async migrateMetafields(deleteFirst = false, skipExisting = true) {
    this.log('Shop Metafields migration started...')
    const sourceMetafields = []
    const destinationMetafields = []
    let params = { limit: 250 }
    do {
      const metafields = await this.source.metafield.list(params)
      metafields.forEach(m => sourceMetafields.push(m))
      params = metafields.nextPageParameters;
    } while (params !== undefined);

    params = { limit: 250 }
    do {
      const metafields = await this.destination.metafield.list(params)
      metafields.forEach(m => destinationMetafields.push(m))
      params = metafields.nextPageParameters;
    } while (params !== undefined);
    await this.asyncForEach(sourceMetafields, async (metafield) => {
      const destinationMetafield = destinationMetafields.find(f => f.key === metafield.key && f.namespace === metafield.namespace)
      if (destinationMetafield && deleteFirst) {
        this.log(`[DUPLICATE METAFIELD] Deleting destination metafield ${metafield.namespace}.${metafield.key}`)
        await this.destination.metafield.delete(destinationMetafield.id)
      }
      if (destinationMetafield && skipExisting && !deleteFirst) {
        this.log(`[EXISTING METAFIELD] Skipping ${metafield.namespace}.${metafield.key}`)
        return
      }
      try {
        delete metafield.owner_id
        delete metafield.owner_resource
        await this.destination.metafield.create(metafield)
      } catch (e) {
        this.error(`[METAFIELD] ${metafield.namespace}.${metafield.key} FAILED TO BE CREATED PROPERLY.`)
      }
    })
    this.log('Shop Metafields migration finished!')
  }

  async migrateSmartCollections(deleteFirst = false, skipExisting = true) {
    this.log('Smart Collections migration started...')
    let params = { limit: 250 }
    const destinationCollections = {}
    do {
      const collections = await this.destination.smartCollection.list(params)
      await this.asyncForEach(collections, async (collection) => {
        destinationCollections[collection.handle] = collection.id
      })
      params = collections.nextPageParameters;
    } while (params !== undefined);
    params = { limit: 250 }
    do {
      const collections = await this.source.smartCollection.list(params)
      await this.asyncForEach(collections, async (collection) => {
        if (destinationCollections[collection.handle] && deleteFirst) {
          this.log(`[DUPLICATE COLLECTION] Deleting destination collection ${collection.handle}`)
          await this.destination.smartCollection.delete(destinationCollections[collection.handle])
        }
        if (destinationCollections[collection.handle] && skipExisting && !deleteFirst) {
          this.log(`[EXISTING COLLECTION] Skipping ${collection.handle}`)
          return
        }
        try {
          await this._migrateSmartCollection(collection)
        } catch (e) {
          this.error(`[COLLECTION] ${collection.handle} FAILED TO BE CREATED PROPERLY.`)
        }
      })
      params = collections.nextPageParameters;
    } while (params !== undefined);
    this.log('Smart Collection migration finished!')
  }

  async migrateCustomCollections(deleteFirst = false, skipExisting = true) {
    this.log('Custom Collections migration started...')
    let params = { limit: 250 }
    const destinationCollections = {}
    const productMap = {}
    const sourceProducts = []
    const destinationProducts = []

    do {
      const products = await this.source.product.list(params)
      products.forEach(p => sourceProducts.push(p))
      params = products.nextPageParameters;
    } while (params !== undefined);

    params = { limit: 250 }
    do {
      const products = await this.destination.product.list(params)
      products.forEach(p => destinationProducts.push(p))
      params = products.nextPageParameters;
    } while (params !== undefined);

    destinationProducts.forEach(p => {
      const sourceProduct = sourceProducts.find(s => s.handle === p.handle)
      if (sourceProduct) {
        productMap[sourceProduct.id] = p.id
      }
    })

    params = { limit: 250 }
    do {
      const collections = await this.destination.smartCollection.list(params)
      await this.asyncForEach(collections, async (collection) => {
        destinationCollections[collection.handle] = collection.id
      })
      params = collections.nextPageParameters;
    } while (params !== undefined);
    params = { limit: 250 }


    do {
      const collections = await this.destination.customCollection.list(params)
      await this.asyncForEach(collections, async (collection) => {
        destinationCollections[collection.handle] = collection.id
      })
      params = collections.nextPageParameters;
    } while (params !== undefined);
    params = { limit: 250 }
    do {
      const collections = await this.source.customCollection.list(params)
      await this.asyncForEach(collections, async (collection) => {
        if (destinationCollections[collection.handle] && deleteFirst) {
          this.log(`[DUPLICATE COLLECTION] Deleting destination collection ${collection.handle}`)
          await this.destination.customCollection.delete(destinationCollections[collection.handle])
        }
        if (destinationCollections[collection.handle] && skipExisting && !deleteFirst) {
          this.log(`[EXISTING COLLECTION] Skipping ${collection.handle}`)
          return
        }
        try {
          await this._migrateCustomCollection(collection, productMap)
        } catch (e) {
          this.error(`[COLLECTION] ${collection.handle} FAILED TO BE CREATED PROPERLY.`, e)
        }
      })
      params = collections.nextPageParameters;
    } while (params !== undefined);
    this.log('Custom Collection migration finished!')
  }

  async migrateBlogs(deleteFirst = false, skipExisting = true) {
    this.log('Blog migration started...')
    let params = { limit: 250 }
    const destinationBlogs = {}
    do {
      const blogs = await this.destination.blog.list(params)
      await this.asyncForEach(blogs, async (blog) => {
        destinationBlogs[blog.handle] = blog.id
      })
      params = blogs.nextPageParameters;
    } while (params !== undefined);
    params = { limit: 250 }
    do {
      const blogs = await this.source.blog.list(params)
      await this.asyncForEach(blogs, async (blog) => {
        if (destinationBlogs[blog.handle] && deleteFirst) {
          this.log(`[DUPLICATE blog] Deleting destination blog ${blog.handle}`)
          await this.destination.blog.delete(destinationBlogs[blog.handle])
        }
        if (destinationBlogs[blog.handle] && skipExisting && !deleteFirst) {
          this.log(`[EXISTING BLOG] Skipping ${blog.handle}`)
          return
        }
        await this._migrateBlog(blog)
      })
      params = blogs.nextPageParameters;
    } while (params !== undefined);
    this.log('Blog migration finished!')
  }

  async migrateArticles(deleteFirst = false, skipExisting = true) {
    const blogParams = {limit: 250}
    const sourceBlogs = await this.source.blog.list(blogParams)
    const destinationBlogs = await this.destination.blog.list(blogParams)
    const matchingBlogs = sourceBlogs.filter((sourceBlog) => {
      return destinationBlogs.find(destinationBlog => destinationBlog.handle === sourceBlog.handle)
    })
    this.log(`Migrating articles for ${matchingBlogs.length} matching blog(s): ${matchingBlogs.map(b => b.handle).join(', ')}`)

    this.asyncForEach(matchingBlogs, async (blog) => {
      const destinationBlog = destinationBlogs.find(b => b.handle === blog.handle)
      let params = { limit: 250 }
      const destinationArticles = {}
      do {
        const articles = await this.destination.article.list(destinationBlog.id, params)
        await this.asyncForEach(articles, async (article) => {
          destinationArticles[article.handle] = article.id
        })
        params = articles.nextPageParameters;
      } while (params !== undefined);

      params = { limit: 250 }
      do {
        const articles = await this.source.article.list(blog.id, params)
        await this.asyncForEach(articles, async (article) => {
          if (destinationArticles[article.handle] && deleteFirst) {
            this.log(`[DUPLICATE article] Deleting destination article ${article.handle}`)
            await this.destination.article.delete(destinationBlog.id, destinationArticles[article.handle])
          }
          if (destinationArticles[article.handle] && skipExisting && !deleteFirst) {
            this.log(`[EXISTING ARTICLE] Skipping ${article.handle}`)
            return
          }
          await this._migrateArticle(destinationBlog.id, article)
        })
        params = articles.nextPageParameters;
      } while (params !== undefined);
    })
  }
}

module.exports = Migrator
