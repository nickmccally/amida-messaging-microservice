import httpStatus from 'http-status';
import Sequelize from 'sequelize';
import db from '../../config/sequelize';
import APIError from '../helpers/APIError';

const Message = db.Message;

function get(req, res, next) {
    Message.scope({ method: ['findAllForUser', req.user] })
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

function list(req, res, next) {
    const queryObject = {
        raw: true,
        where: {},
    };

    if (req.query.limit) {
        queryObject.limit = req.query.limit;
    }

    if (req.query.offset) {
        queryObject.limit = req.query.limit;
    }

    const senders = [Sequelize.fn('ARRAY_AGG', Sequelize.fn('DISTINCT', Sequelize.col('from'))), 'senders'];
    const originalMessageId = 'originalMessageId';
    const mostRecent = [Sequelize.fn('MAX', Sequelize.col('createdAt')), 'mostRecent'];
    const count = [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'];
    const archived = [Sequelize.fn('bool_or', Sequelize.col('isArchived')), 'archived'];
    const unread = [Sequelize.fn('bool_and', (Sequelize.literal('CASE WHEN "readAt" IS NULL THEN true ELSE false END'))), 'unread'];
    queryObject.group = 'originalMessageId';
    queryObject.attributes = [senders, originalMessageId, mostRecent, count, archived, unread];

    Message.scope({ method: ['findAllForUser', req.user] })
        .findAll(queryObject)
        .then((threadsResponse) => {
            Message.scope({ method: ['findAllForUser', req.user] })
            .findAll({ raw: true })
            .then((allMessages) => {
                const threads = threadsResponse;
                let i;
                let j;
                let maxReadDate;
                let minUnreadCreatedDate;
                let minSubjectDate;
                for (i = 0; i < threads.length; i++) { // eslint-disable-line no-plusplus
                    threads[i].count = parseInt(threads[i].count, 10);
                    for (j = 0; j < allMessages.length; j++) { // eslint-disable-line no-plusplus
                        if (threads[i].unread) {
                            if (threads[i].refMessageId) {
                                if (minUnreadCreatedDate > allMessages[j].createdAt) {
                                    minUnreadCreatedDate = allMessages[j].createdAt;
                                    threads[i].refMessageId = allMessages[j].id;
                                }
                            } else { threads[i].refMessageId = allMessages[j].id; }
                        } else if (threads[i].refMessageId) {
                            if (maxReadDate < allMessages[j].readAt) {
                                maxReadDate = allMessages[j].readAt;
                                threads[i].refMessageId = allMessages[j].id;
                            }
                        } else { threads[i].refMessageId = allMessages[j].id; }
                        if (!minSubjectDate || minSubjectDate > allMessages[j].createdAt) {
                            minSubjectDate = allMessages[j].createdAt;
                            threads[i].subject = allMessages[j].subject;
                        }
                    }
                }
                res.send(threads);
            });
        })
        .catch(next);
}

export default { get, list };
