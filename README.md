# datarink-backend
Revamped backend for datarink

## Setup
1. Run `npm install`.
2. In `config.js`, specify `DB_HOST`, `DB_NAME`, `DB_USER_MASTER`, and `DB_USER_MASTER_PASSWORD`.
3. Create database tables by running `node create-tables.js`.
4. In `config.js`, follow the instructions for creating a database writer role (used by the game scraper). Fill in `DB_USER_WRITER` and `DB_USER_WRITER_PASSWORD` with this role's name and password.
5. In `config.js`, follow the instructions for creating a database reader role (used by the API). Fill in `DB_USER_READER` and `DB_USER_READER_PASSWORD` with this role's name and password.
6. Populate database using `scrape-games.js`. For example, `node scrape-games.js 2016 20001-21230 save`.
    - Use the `save` flag to save the downloaded json files. Replace this flag with `local` to use local files. If `local` is specified but a file is not found, it will be downloaded and saved.
    - `save` and `local` will save and load data from `/scripts/raw-data/`. **The `raw-data` folder needs to be created before running the scraper.**

## Usage
- Use `npm run dev` to allow cross-origin requests for local development.
- To lint JavaScript, run `npm run lint`.
