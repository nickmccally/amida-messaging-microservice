import httpStatus from 'http-status';
import Promise from 'bluebird';
import db from '../../config/sequelize';
import APIError from '../helpers/APIError';

const Message = db.Message;
const Thread = db.Thread;
const User = db.User;

/**
 * Start a new thread
 * @property {Array} req.body.participants - Array of usernames to include in the thread.
 * @property {string} req.body.subject - Subject line of the message
 * @property {string} req.body.message - Body of the message
 * @property {string} req.body.topic - Topic of the thread
 * @returns {Message}
 */
function create(req, res, next) {
    const participants = req.body.participants;
    console.log("found participant", participants)
    let users = [];
    let userPromises = [];
    participants.forEach((participant) => {
      let userPromise = User.findOrCreate({where: {username: participant}})
      .spread((user, created) => {
        users.push(user);
        // console.log(created)
      });
      userPromises.push(userPromise);
    });

    Promise.all(userPromises).then(() => {
      Thread.create({topic: req.body.topic}).then((thread) => {
        thread.setUsers(users);
        Message.create({
          from: req.user.username,
          to: participants,
          owner: req.user.username,
          subject: '',
          message: req.body.message,

        }).then((message) => {
          thread.addMessage(message);
          let addUserMessagePromises = [];
          users.forEach((user) => {
            let addUserMessagePromise = user.addMessage(message).then(() => {

            });
            addUserMessagePromises.push(addUserMessagePromise);
          });
          Promise.all(addUserMessagePromises).then(() => {
            res.send({message})
          })
        })
      });
    })
}

export default {
    create
};
