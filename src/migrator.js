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