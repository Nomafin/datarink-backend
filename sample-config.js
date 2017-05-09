module.exports = {
  DB_HOST: '',
  DB_NAME: '',

  /**
   * Master role for creating tables, dropping tables, etc.
   * This role is setup by AWS
   */
  DB_USER_MASTER: '',
  DB_USER_MASTER_PASSWORD: '',

  /**
   * Writer role for inserting, updating, and deleting rows (e.g., during scraping)
   * Create this role after creating tables:
   * CREATE ROLE ${DB_USER_WRITER} LOGIN PASSWORD '${DB_USER_WRITER_PASSWORD}';
   *
   * To give the role read-only permissions on all EXISTING tables:
   * GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${DB_USER_WRITER};
   */
  DB_USER_WRITER: '',
  DB_USER_WRITER_PASSWORD: '',

  /**
   * Reader role for selecting rows
   * Create this role after creating tables:
   * CREATE ROLE ${DB_USER_READER} LOGIN PASSWORD '${DB_USER_READER_PASSWORD}';
   *
   * To give the role read-only permissions on all EXISTING tables:
   * GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${DB_USER_READER};
   */
  DB_USER_READER: '',
  DB_USER_READER_PASSWORD: '',
};
