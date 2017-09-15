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
        console.log(`load----------${message.to}`);
        return next();
    })
    .catch(e => next(e));
}

/**
 * Get message
 * @returns {Message}
 * The load() function searches for message with specific request 'id' in db
 * and creates object 'Message' which we use in this function.
 * If the function has been read before, do not change the readAt time
 */
function get(req, res) {
    console.log(`inside get request`);
    console.log(`get--------${req.message.id}`);

    if (req.message) {
        req.message.update  ({
        readAt: new Date(),
        })
    }
    // this works too
    // if (req.message) {
    //     req.message.update  ({
    //     readAt: db.sequelize.fn('NOW')
    //     }).then((message)=> {
    //         req.message = message;
    //         })
    // }
    return res.send(req.message);
    //return res.json(req.message); //this works too

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
    // Defining a variable arrayLength before the loop wasn't working.
    // Getting 'arrayLength undefined' error
    var messageArray = [];
    // Saves separate instance where each recipient is the owner
    for (let i = 0; i < req.body.to.length; i += 1) {
        messageArray.push({
            to: req.body.to,
            from: req.body.from,
            subject: req.body.subject,
            message: req.body.message,
            owner: req.body.to[i],
            created: new Date(),
        })
    }
    Message.bulkCreate(messageArray);
    // Saves an instance where the sender is owner and readAt=current time
    Message.build({
            to: req.body.to,
            from: req.body.from,
            subject: req.body.subject,
            message: req.body.message,
            owner: req.body.from,
            created: new Date(),
            readAt: new Date(),
    }).save()
      .then(savedMessage => res.json(savedMessage))
      .catch(e => next(e));
}

// function send(req, res, next) {
//     // Each iteration saves the recipient's name from the to[] array as the owner to the db.
//     // Defining a variable arrayLength before the loop wasn't working.
//     // Getting 'arrayLength undefined' error
//     function build(owner, readAt){
//         //const message = 
//         return Message.build({
//             to: req.body.to,
//             from: req.body.from,
//             subject: req.body.subject,
//             message: req.body.message,
//             owner: owner,
//             created: new Date(),
//             readAt: readAt,
//         });
//     }
//     //let saveMessage = null;
//     // Saves separate instance where each recipient is the owner
//     for (let i = 0; i < req.body.to.length; i += 1) {
//         build(req.body.to[i]).save();
//     }
//     // Saves an instance where the sender is owner
//     build(req.body.from, new Date()).save()
//                         .then(savedMessage => res.json(savedMessage))
//                         .catch(e => next(e));
// }


/**
 * Returns a list of messages sent to the owner
 * @returns {Array}
 */
function list(req, res) {
    console.log(`inside get request`);
    console.log(`list--------${req.params.userId}`);
    
    Message.findAll({
        where:{
            owner: req.params.userId
        }}).then(listOfMessages => {
            if (!message) {     //how to take care of error handling?
             const e = new Error('Message does not exist');
             e.status = httpStatus.NOT_FOUND;
             res.send(e);
         }
            res.send(listOfMessages)
    }).catch(e => res.send(e));
    
    // .then((message) => {
    //     if (!message) {
    //         const e = new Error('Message does not exist');
    //         e.status = httpStatus.NOT_FOUND;
    //         return next(e);
    //     }
    //     req.message = message; // eslint-disable-line no-param-reassign
    //     console.log(`load----------${message.to}`);
    //     return next();
    // })
    // .catch(e => next(e));

    // return res.send(req.message);

}

function count() {}

function remove() {}

export default { send, get, list, count, remove, load };
