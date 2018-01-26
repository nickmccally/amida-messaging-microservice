import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLInt,
    GraphQLList,
    GraphQLBoolean,
    GraphQLNonNull,
} from 'graphql';
import { Op } from 'sequelize';

import db from '../config/sequelize';

const Message = db.Message;
const userMessageScope = user => Message.scope({ method: ['forUser', user] });

const MessageType = new GraphQLObjectType({
    name: 'Message',
    fields: {
        id: {
            type: GraphQLInt,
        },
        to: {
            type: new GraphQLList(GraphQLString),
        },
        from: {
            type: GraphQLString,
        },
        message: {
            type: GraphQLString,
        },
        subject: {
            type: GraphQLString,
        },
        originalMessageId: {
            type: GraphQLInt,
        },
        parentMessageId: {
            type: GraphQLInt,
        },
        readAt: {
            type: GraphQLString,
        },
        isDeleted: {
            type: GraphQLBoolean,
        },
        isArchived: {
            type: GraphQLBoolean,
        },
        createdAt: {
            type: GraphQLString,
        },
    },
});

const ThreadType = new GraphQLObjectType({
    name: 'Thread',
    fields: {
        count: {
            type: GraphQLInt,
            resolve: parentObject => parentObject.messages.length,
        },
        subject: {
            type: GraphQLString,
            resolve: parentObject => (parentObject.messages.length > 1 ?
                parentObject.messages[0].subject :
                null),
        },
        from: {
            type: new GraphQLList(GraphQLString),
            resolve: parentObject => parentObject.messages.map(message => message.from),
        },
        mostRecent: {
            type: GraphQLString,
            resolve: parentObject => (parentObject.messages.length > 1 ?
                parentObject.messages[parentObject.messages.length - 1].createdAt :
                null),
        },
        messages: {
            type: new GraphQLList(MessageType),
        },
    },
});

export default new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'RootQueryType',
        fields: {
            healthCheck: {
                type: GraphQLString,
                resolve() {
                    return 'as a horse!';
                },
            },
            message: {
                type: MessageType,
                args: {
                    id: { type: new GraphQLNonNull(GraphQLInt) },
                },
                resolve(parentObject, args, { user }) {
                    return userMessageScope(user).findById(args.id);
                },
            },
            messages: {
                type: new GraphQLList(MessageType),
                args: {
                    unread: { type: GraphQLBoolean },
                    archived: { type: GraphQLBoolean },
                    received: { type: GraphQLBoolean },
                    sent: { type: GraphQLBoolean },
                },
                resolve(parentObject, { unread, archived, received, sent }, { user }) {
                    const where = {};

                    if (unread !== undefined) {
                        where.readAt = unread ? null : { [Op.ne]: null };
                    }
                    if (archived !== undefined) {
                        where.isArchived = archived;
                    }
                    if (received === true) {
                        where.to = { [Op.contains]: [user.username] };
                    }
                    if (sent === true) {
                        where.from = user.username;
                    }

                    return userMessageScope(user).findAll({ where });
                },
            },
            thread: {
                type: ThreadType,
                args: {
                    originalMessageId: { type: new GraphQLNonNull(GraphQLInt) },
                },
                resolve(parentObject, { originalMessageId }, { user }) {
                    return userMessageScope(user).findAll({ where: { originalMessageId } })
                    .then(messages => ({ messages }));
                },
            },
            threads: {
                type: new GraphQLList(ThreadType),
                args: {
                    archived: { type: GraphQLBoolean },
                    unread: { type: GraphQLBoolean },
                },
                resolve(parentObject, { archived, unread }, { user }) {
                    return userMessageScope(user).aggregate('originalMessageId', 'DISTINCT', { plain: false })
                    .then(distinctObjects =>
                        Promise.all(distinctObjects.map(({ DISTINCT: originalMessageId }) =>
                            userMessageScope(user).findAll({ where: { originalMessageId } })))
                        .then(messageLists =>
                            messageLists.map(messages => ({ messages })))
                    )
                    .then((threads) => {
                        if (archived === false) {
                            return threads.filter(({ messages }) =>
                                messages.some(message => !message.isArchived));
                        } else if (archived === true) {
                            return threads.filter(({ messages }) =>
                                messages.every(message => message.isArchived));
                        }
                        return threads;
                    })
                    .then((threads) => {
                        if (unread === false) {
                            return threads.filter(({ messages }) =>
                                messages.every(message => message.readAt !== null));
                        } else if (unread === true) {
                            return threads.filter(({ messages }) =>
                                messages.some(message => message.readAt === null));
                        }
                        return threads;
                    });
                },
            },
        },
    }),
});
