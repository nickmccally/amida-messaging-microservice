/**
 * Thread Schema
 */
module.exports = (sequelize, DataTypes) => {
    const Thread = sequelize.define('Thread', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
    });
    // Class methods

    return Thread;
};
