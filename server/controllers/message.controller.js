import httpStatus from 'http-status';
import db from '../../config/sequelize';

const Message = db.Message;

/**
 * Load message and append to req.
 */
function load(req, res, next, id) {
    Message.findById(id)
    .then((message) => { 
        if (!message) {
            const e = new Error('Message does not exist');
            e.status = httpStatus.NOT_FOUND;
            return next(e);
        }
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
    console.log(`inside get ${req.message}`);
    return res.json(req.message);
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
    console.log(`length of recipient array-------${req.body.to.length}`);
    // var array_lenth = req.body.to.length;
    // console.log('array_length: '+array_length);

    // defining a variable for array length wasn't working
    let saveMessage = null;
    for (let i = 0; i < req.body.to.length; i += 1) {
        const message = Message.build({
            to: req.body.to,
            from: req.body.from,
            subject: req.body.subject,
            message: req.body.message,
            owner: req.body.to[i],
            created: db.sequelize.fn('NOW'),
        });
        //  message.save()
        //  .then(savedMessage => res.json(savedMessage))
        //  .catch(e => next(e));

        saveMessage = message.save();
    }
    saveMessage.then(savedMessage => res.json(savedMessage))
                 .catch(e => next(e));
}

//  message.save()
//        .then(savedMessage => res.json(savedMessage))
//        .catch(e => next(e));


function list() {}

function count() {}

function remove() {}

export default { send, get, list, count, remove, load };
