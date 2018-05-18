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

const Article = sequelize.import('../server/models/article.model');
const User = sequelize.import('../server/models/user.model');
const UserTrack = sequelize.import('../server/models/userTrack.model');
// const Thread = sequelize.import('../server/models/thread.model');
// const UserMessage = sequelize.import('../server/models/userMessage.model');
// const UserThread = sequelize.import('../server/models/userThread.model');

// Article.belongsToMany(User);
// Article.hasOne(User, {as: 'u'});
// Threads
// Thread.hasMany(Message);
// Thread.hasOne(Message, {as: 'LastMessage'});
// Thread.belongsToMany(User, {through: 'UserThread'});
//
// // Messages
// Message.belongsTo(Thread)
// Message.belongsTo(User, {as: 'Sender'})
// Message.belongsToMany(User, {through: 'UserMessage'});

// Users
// User.belongsToMany(Thread, {through: 'UserThread'});
// User.belongsToMany(Message, {through: 'UserMessage'})



db.Article = Article;
db.User = User;
db.UserTrack = UserTrack;
// db.UserMessage = UserMessage;
// db.UserThread = UserThread;

// assign the sequelize variables to the db object and returning the db.
module.exports = _.extend({
    sequelize,
    Sequelize,
}, db);
