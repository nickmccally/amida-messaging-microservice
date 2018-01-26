import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLInt,
    GraphQLList,
    GraphQLBoolean,
    GraphQLNonNull,
} from 'graphql';

import db from '../config/sequelize';

const Message = db.Message;

const MessageType = new GraphQLObjectType({
    name: 'Message',
    fields: {
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
        owner: {
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
                resolve() {
                    return Message.findAll();
                },
            },
        },
    }),
});
