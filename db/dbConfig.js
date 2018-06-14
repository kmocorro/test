let { Pool } = require('pg');
let config = require('./config');

let pool = new Pool({
    user: config.config.user,
    host: config.config.host,
    database: config.config.database,
    password: config.config.password,
    port: config.config.port
});

exports.pool = pool;
