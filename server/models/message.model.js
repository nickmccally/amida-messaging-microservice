/**
 * Message Schema
 */
module.exports = (sequelize, DataTypes) => {
    const hooks = {
        afterCreate(message) {
            // make sure root messages have originalMessageId set
            if (message.originalMessageId === undefined
             || message.originalMessageId === null) {
                return message.update({ originalMessageId: message.id });
            }
            return null;
        },
    };

    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        /**
         * Each sent message is replicated for every recipient. This allows
         * users to maintain their own copies of a message for tracking
         * readAt times and soft deletion. It also allows for per-user
         * message threading.
         */
        owner: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        originalMessageId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        parentMessageId: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        /* eslint-disable new-cap */
        to: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: false,
        },
        from: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        subject: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        readAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        isDeleted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        isArchived: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    }, {
        defaultScope: {
            where: {
                isDeleted: false,
                isArchived: false,
            },
        },
        scopes: {
            forUser(user) {
                return {
                    where: {
                        owner: user.username,
                        isDeleted: false,
                        isArchived: false,
                    },
                };
            },
        },
    });

    // Class methods

    return Message;
};
