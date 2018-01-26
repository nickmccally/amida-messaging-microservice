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
                resolve(parentObject, args) {
                    return Message.findById(args.id);
                },
            },
            messages: {
                type: new GraphQLList(MessageType),
                args: {
                    unread: { type: GraphQLBoolean },
                    archived: { type: GraphQLBoolean },
                },
                resolve(parentObject, { unread, archived }) {
                    const where = {};

                    if (unread !== undefined) {
                        where.readAt = unread ? null : { [Op.ne]: null };
                    }
                    if (archived !== undefined) {
                        where.isArchived = archived;
                    }

                    return Message.findAll({ where });
                },
            },
        },
    }),
});
