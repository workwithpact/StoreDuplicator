# Store Duplicator
This tools makes it easy to duplicate a store's content onto another, either to spin up a staging env or to simply test stuff out without risking anything in production.

## Setting it all up

You'll first need to create 2 private apps. One needs read access on the source store, the other needs read/write on the destination store.

Here are the access copes that will be required:
- Store content like articles, blogs, comments, pages, and redirects
- Products, variants and collections
- Theme templates and theme assets

Then, you will need to create a `.env` file (copy it from `.env.example`) and fill it out with the right api information you will have gathered from the private apps process.

## Usage

By default, simply running `yarn start` will validate that each store is able to be read from. It will not do anything unless specifically told to using flags.

###  Available flags

- `--products` copies over products (and variants, images & metafields)
- `--delete-products` will override pre-existing products.
- `--collections` copies over collections
- `--delete-collections` will override pre-existing collections.
- `--pages` copies over pages (along with metafields)
- `--delete-pages` will override pre-existing pages.
- `--blogs` copies over blogs
- `--delete-blogs` will override pre-existing articles.
- `--articles` copies over articles
- `--delete-articles` will override pre-existing articles.


### Examples

- Copying only product: run `yarn start --products`
- Copying only pages: run `yarn start --pages`
- Copying only articles: run `yarn start --articles`
- Copying products & articles: run `yarn start --products --articles`
- Copying products, pages & articles: run `yarn start --products --articles --pages`