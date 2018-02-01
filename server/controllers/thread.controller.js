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

function findFirstUnreadMessageId(thread, allMessages) {
    let minUnreadCreatedDate;
    let minUnreadMessageId;
    let j;
    for (j = 0; j < allMessages.length; j++) { // eslint-disable-line no-plusplus
        if (allMessages[j].originalMessageId !== thread.originalMessageId) {
            continue; // eslint-disable-line no-continue
        }
        if (minUnreadMessageId) {
            if (minUnreadCreatedDate > allMessages[j].createdAt) {
                minUnreadCreatedDate = allMessages[j].createdAt;
                minUnreadMessageId = allMessages[j].id;
            }
        } else {
            minUnreadMessageId = allMessages[j].id;
        }
    }
    return minUnreadMessageId;
}

function findLastReadMessageId(thread, allMessages) {
    let maxCreatedDate;
    let maxCreatedMessageId;
    let j;
    for (j = 0; j < allMessages.length; j++) { // eslint-disable-line no-plusplus
        if (allMessages[j].originalMessageId !== thread.originalMessageId) {
            continue; // eslint-disable-line no-continue
        }
        if (maxCreatedMessageId) {
            if (maxCreatedDate < allMessages[j].readAt) {
                maxCreatedDate = allMessages[j].readAt;
                maxCreatedMessageId = allMessages[j].id;
            }
        } else {
            maxCreatedMessageId = allMessages[j].id;
        }
    }
    return maxCreatedMessageId;
}

function findFirstSubjectText(thread, allMessages) {
    let minSubjectDate;
    let minSubject;
    let j;
    for (j = 0; j < allMessages.length; j++) { // eslint-disable-line no-plusplus
        if (allMessages[j].originalMessageId !== thread.originalMessageId) {
            continue;  // eslint-disable-line no-continue
        }
        if (!minSubjectDate || minSubjectDate > allMessages[j].createdAt) {
            minSubjectDate = allMessages[j].createdAt;
            minSubject = allMessages[j].subject;
        }
    }
    return minSubject;
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
                for (i = 0; i < threads.length; i++) { // eslint-disable-line no-plusplus
                    threads[i].count = parseInt(threads[i].count, 10);
                    if (threads[i].unread) {
                        threads[i].refMessageId
                          = findFirstUnreadMessageId(threads[i], allMessages);
                    } else {
                        threads[i].refMessageId
                          = findLastReadMessageId(threads[i], allMessages);
                    }
                    threads[i].subject
                      = findFirstSubjectText(threads[i], allMessages);
                }
                res.send(threads);
            });
        })
        .catch(next);
}

export default { get, list };
