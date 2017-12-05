import httpStatus from 'http-status';
import db from '../../config/sequelize';
import APIError from '../helpers/APIError';

const Message = db.Message;

const useUnscoped = (url) => {
  const unscopedRoutes = ['/unarchive/', '/delete/'];
  return unscopedRoutes.find(route => url.includes(route)) != undefined;
}

/**
 * Used to load appropriate scope per request.
 */
const messageScope = function(req) {
  if (useUnscoped(req.originalUrl)) {
    return Message.scope({ method: ['findAllForUser', req.user] });
  } else {
    return Message.scope({ method: ['forUser', req.user] });
  }
};

/**
 * Load message and append to req.
 * Message cannot be deleted or archived.
 */
function load(req, res, next, id) {
    messageScope(req)
        .findById(id)
        .then((message) => {
            if (!message) {
                const err = new APIError('Message does not exist', httpStatus.NOT_FOUND, true);
                return next(err);
            }
            req.message = message; // eslint-disable-line no-param-reassign
            return next();
        })
        .catch(e => next(e));
}

/**
 * Checks that the user authenticated with JWT is in the `from`
 * field of the message (for send or reply).
 */
function checkFromUser(req, res, next) {
    if (req.user.username !== req.body.from) {
        const err = new APIError('Authenticated user must match `from` field in message', httpStatus.FORBIDDEN, true);
        return next(err);
    }
    return next();
}

/**
 * Get message
 * @returns {Message}
 */
function get(req, res) {
    if (req.message.readAt == null) {
        return req.message.update({
            readAt: new Date(),
        }).then(() => res.send(req.message));
    }
    return res.send(req.message);
}

/**
 * Send new message
 * @property {Array} req.body.to - Array of user IDs to send the message to.
 * @property {string} req.body.from - The user ID of the sender
 * @property {string} req.body.subject - Subject line of the message
 * @property {string} req.body.message - Body of the message
 * @returns {Message}
 */
function send(req, res, next) {
    // Each iteration saves the recipient's name from the to[] array as the owner to the db.
    const messageArray = [];
    const newTime = new Date();

    // Saves an instance where the sender is owner and readAt=current time
    Message.create({
        to: req.body.to,
        from: req.body.from,
        subject: req.body.subject,
        message: req.body.message,
        owner: req.body.from,
        createdAt: newTime,
        readAt: newTime,
    }).then(msg => msg.update({ originalMessageId: msg.id }))
      .then((msg) => {
        // Saves separate instance where each recipient is the owner
          for (let i = 0; i < req.body.to.length; i += 1) {
              messageArray.push({
                  to: req.body.to,
                  from: req.body.from,
                  subject: req.body.subject,
                  message: req.body.message,
                  owner: req.body.to[i],
                  createdAt: new Date(),
                  originalMessageId: msg.id,
              });
          }
          Message.bulkCreate(messageArray)
            .then(() => res.json(msg))
            .catch(e => next(e));
      }).catch(e => next(e));
}

/**
 * Reply to a message.
 * @property {Array} req.body.to - Array of user IDs to send the message to.
 * @property {string} req.body.from - The user ID of the sender
 * @property {string} req.body.subject - Subject line of the message
 * @property {string} req.body.message - Body of the message
 * @property {Number} req.params.messageId - DB ID of the message being replied to
 * @returns {Message}
 */
function reply(req, res, next) {
    const messageId = req.params.messageId;
    const parentMessage = req.message;
    // Make sure that the person replying was in the "to" of that message
    if (!parentMessage.to.includes(req.user.username)) {
        const err = new APIError('Cannot reply to a message not sent to you!', httpStatus.FORBIDDEN, true);
        return next(err);
    }
    // Then, generate messages a la send()
    // Each iteration saves the recipient's name from the to[] array as the owner to the db.
    const messageArray = [];
    const newTime = new Date();

    // Saves separate instance where each recipient is the owner
    for (let i = 0; i < req.body.to.length; i += 1) {
        messageArray.push({
            to: req.body.to,
            from: req.body.from,
            subject: req.body.subject,
            message: req.body.message,
            owner: req.body.to[i],
            createdAt: newTime,
            isDeleted: false,
            parentMessageId: messageId,
            originalMessageId: parentMessage.originalMessageId,
        });
    }

    const bulkCreate = Message.bulkCreate(messageArray);

    // Saves an instance where the sender is owner and readAt=current time
    const messageCreate = Message.create({
        to: req.body.to,
        from: req.body.from,
        subject: req.body.subject,
        message: req.body.message,
        owner: req.body.from,
        createdAt: newTime,
        readAt: newTime,
        isDeleted: false,
        parentMessageId: messageId,
        originalMessageId: parentMessage.originalMessageId,
    });

    // once the bulkCreate and create promises resolve,
    // send the sender's saved message or an error
    return Promise
        .join(bulkCreate, messageCreate, (bulkRes, messageRes) => res.json(messageRes))
        .catch(e => next(e));
}

// returns a list of messages
// Currently, there is no distinction between a message created by a user, &
// a message sent by that user, since he is the 'owner' in both cases.
// This needs integration with auth microservice
// Query paramters: 'from', 'summary', 'limit'
// To return archived messages use url param archived=true
function list(req, res) {
    const queryObject = {
        where: {},
    };

    if (req.query.from) {
        const whereObject = {};
        whereObject.from = req.query.from;
        queryObject.where = { ...queryObject.where, ...whereObject };
    }

    if (req.query.limit) {
        queryObject.limit = req.query.limit;
    }

    if (req.query.summary) {
        queryObject.attributes = ['subject', 'from', 'createdAt'];
    }

    if (req.query.archived && req.query.archived === 'true') {
        queryObject.where.isArchived = true;
        queryObject.where.isDeleted = false;
        queryObject.where.owner = req.user.username;
        Message
            .unscoped().findAll(queryObject)
            .then(results => res.send(results));
    } else {
        Message
          .scope({ method: ['forUser', req.user] })
          .findAll(queryObject)
          .then(results => res.send(results));
    }
}

function count() {}

/**
 * Soft delete
 * sets isDelete of message with the userID to true
 * @returns {Message}
 */
function remove(req, res) {
    if (req.message) {
        req.message.update({ isDeleted: true });
    }
    return res.send(req.message);
}

/**
 * Archive
 * sets isArchived of message with the userID to true
 * @returns {Message}
 */
function archive(req, res) {
    if (req.message) {
        req.message.update({
            isArchived: true,
        });
    }
    return res.send(req.message);
}

/**
 * Unarchive
 * sets isArchived of message with the userID to false
 * @returns {Message}
 */
function unarchive(req, res) {
    if (req.message) {
        req.message.update({
            isArchived: false,
        });
    }
    return res.send(req.message);
}

export default { send, reply, get, list, count, remove, load, archive, unarchive, checkFromUser };
