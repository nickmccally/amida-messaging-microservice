/**
 * User Schema
 */
module.exports = (sequelize, DataTypes) => {
    const UserTrack = sequelize.define('UserTrack', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        track: {
          type: DataTypes.STRING,
          allowNull: false
        }
    });
    // Class methods

    return UserTrack;
};
