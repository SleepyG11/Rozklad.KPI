import { Model, DataTypes } from "sequelize";

export class Link extends Model{}

export default function linkInit(sequelize){
    return Link.init({
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        chatId: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        hash: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        type: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
        },
        updatedAt: {
            type: DataTypes.DATE,
        },
        createdAt: {
            type: DataTypes.DATE,
        },
    }, {
        createdAt: true,
        updatedAt: true,
        sequelize
    })
}