import httpStatus from 'http-status';
import db from '../../config/sequelize';

const Message = db.Message;

/**
 * Load message and append to req.
 */
function load(req, res, next, id) {
    Message.scope({ method: ['forUser', req.user]}).findById(id)
    .then((message) => {
        if (!message) {
            const e = new Error('Message does not exist');
            e.status = httpStatus.NOT_FOUND;
            return next(e);
        }
        console.log("load-req.message: "+req.message);
        req.message = message; // eslint-disable-line no-param-reassign
        return next();
    })
    .catch(e => next(e));
}

/**
 * Get message
 * @returns {Message}
 */
function get(req, res) {
    if (req.message) {
        req.message.update({
            readAt: new Date(),
        });
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
    const createdTime = new Date();
    const messageArray = [];

    // Saves separate instance where each recipient is the owner
    for (let i = 0; i < req.body.to.length; i += 1) {
        messageArray.push({
            to: req.body.to,
            from: req.body.from,
            subject: req.body.subject,
            message: req.body.message,
            owner: req.body.to[i],
            created: new Date(),
            isDeleted: false,
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
        created: new Date(),
        readAt: new Date(),
        isDeleted: false,
    }).then(savedMessage => res.json(savedMessage))
      .catch(e => next(e));
    // once the bulkCreate and create promises resolve, send the sender's saved message or an error
    Promise
        .join(bulkCreate, messageCreate, (bulkResult, messageResult) => res.json(messageResult))
        .catch(e => next(e));
}

// returns a list of messages
// Currently, there is no distinction between a message created by a user, &
// a message sent by that user, since he is the 'owner' in both cases.
// This needs integration with auth microservice
// Query paramters: 'from', 'summary', 'limit'
function list(req, res) {
    const queryObject = {};


    if (req.query.from) {
        const whereObject = {};
        whereObject.from = req.query.from;
        queryObject.where = whereObject;
    }

    if (req.query.limit) {
        queryObject.limit = req.query.limit;
    }

    if (req.query.summary) {
        queryObject.attributes = ['subject', 'from', 'createdAt'];
    }

    Message
        .scope({ method: ['forUser', req.user]}).findAll(queryObject)
        .then(results => res.send(results));
}

function count() {}

/**
 * Soft delete
 * sets isDelete of message with the userID to true
 * @returns {Message}
 */
function remove(req,res) {
    if (req.message) {
    console.log("req.message: "+JSON.stringify(req.message));
        req.message.update({
            isDeleted: true,
        });
    }
    return res.send(req.message);
}

export default { send, get, list, count, remove, load };
