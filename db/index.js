const mysql = require('mysql');
const esearch = require('elasticsearch');
let config = {
    host: 'localhost',
    user: 'root',
    password: '1994311',
    database: 'project',
    port: 3306,
    multipleStatements: true,
};
let es = () => {
   return new esearch.Client({
        host: 'localhost:9200/es_first_results',
        log: 'trace'
    });
};

let pool = mysql.createPool(config);
let query = (sql, values) => {

    return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
        if (err) {
            reject(err);
        } else {
            connection.query(sql, values, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
                connection.release();
            })
        }
    })
  })
};
module.exports = {
    query,
    es,
    config
};