import Sequelize from 'sequelize';
import _ from 'lodash';
import config from './config';

let dbLogging;
if (config.env === 'test') {
    dbLogging = false;
} else {
    dbLogging = console.log;
}

const db = {};

// // connect to postgres db
const sequelize = new Sequelize(config.postgres.db,
  config.postgres.user,
  config.postgres.passwd,
    {
        dialect: 'postgres',
        port: config.postgres.port,
        host: config.postgres.host,
        logging: dbLogging,
    });

db.Message = sequelize.import('../server/models/message.model');
db.Thread = sequelize.import('../server/models/thread.model');

// assign the sequelize variables to the db object and returning the db.
module.exports = _.extend({
    sequelize,
    Sequelize,
}, db);
