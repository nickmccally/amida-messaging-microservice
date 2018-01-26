import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLInt,
    GraphQLList,
    GraphQLBoolean,
} from 'graphql';

import db from '../config/sequelize';

const Message = db.Message;

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
                type: new GraphQLObjectType({
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
                }),
                args: {
                    id: { type: GraphQLInt },
                },
                resolve(parentObject, args) {
                    const result = Message.findById(args.id);
                    return result;
                },
            },
        },
    }),
});
