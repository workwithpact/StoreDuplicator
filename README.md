# Store Duplicator
This tools makes it easy to duplicate a store's content onto another, either to spin up a staging env or to simply test stuff out without risking anything in production.

## Setting it all up

You'll first need to create 2 private apps. One needs read access on the source store, the other needs read/write on the destination store.

Here are the access copes that will be required:
- Store content like articles, blogs, comments, pages, and redirects
- Products, variants and collections
- Theme templates and theme assets

Then, you will need to create a `.env` file (copy it from `.env.example`) and fill it out with the right api information you will have gathered from the private apps process.