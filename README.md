# Shopify Store Duplicator
This tool makes it easy to duplicate a store's content onto another, either to spin up a staging env or to simply test stuff out without risking anything in production.

## What it supports
With this tool, you can sync/duplicate the following resources:
- Products (and their variants, including images, alt tags and images being tied to specific variants as well as metafields)
- Smart Collections (Along with its image, filters and metafields)
- Custom Collections (Along with its image, products (mapped using their handle) and metafields)
- Shop-level metafields
- Blogs (along with their metafields)
- Articles (mapped to a blog of the same handle. Comes along with their metafields)
- Pages (along with their metafields)

## Setting it all up
You'll first need to [create 2 private apps](https://help.shopify.com/en/manual/apps/private-apps#generate-credentials-from-the-shopify-admin "Read Shopify's documentation on how to create a private app"). One needs read access on the source store, the other needs read/write on the destination store.

Here are the access copes that will be required:
- Store content like articles, blogs, comments, pages, and redirects
- Products, variants and collections

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
- `--metafields` copies over shop metafields
- `--delete-metafields` will override pre-existing shop metafields.
- `--all` will sync everything.


### Examples

- Copying only product: run `yarn start --products`
- Copying only pages: run `yarn start --pages`
- Copying only articles: run `yarn start --articles`
- Copying products & articles: run `yarn start --products --articles`
- Copying products, pages & articles: run `yarn start --products --articles --pages`
- Just copy everything you can: run `yarn start --all`

## Issues and bugs
Create a new issue, or issue a new PR on this repo if you've found an issue and would like it fixed.

## License 
MIT. Do whatever you like with this stuff ✌️.
