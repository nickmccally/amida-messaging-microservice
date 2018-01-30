import httpStatus from 'http-status';
import db from '../../config/sequelize';
import APIError from '../helpers/APIError';

const Message = db.Message;

function get(req, res, next) {
    Message.scope({ method: ['forUser', req.user] })
        .findAll({
            where: {
                originalMessageId: req.params.originalMessageId,
            },
        })
        .then((messages) => {
            if (messages.length === 0) {
                const err = new APIError('Original message does not exist', httpStatus.NOT_FOUND, true);
                next(err);
            } else {
                res.send(messages);
            }
        })
        .catch(next);
}

export default { get };
