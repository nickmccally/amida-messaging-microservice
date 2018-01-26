import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
} from 'graphql';

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
        },
    }),
});
