import { Model, DataTypes } from "sequelize";

export class Chat extends Model{}

export default function chatInit(sequelize){
    return Chat.init({
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true
        },
        groupUUID: {
            type: DataTypes.UUID,
        },
        parentChatId: {
            type: DataTypes.BIGINT,
        },
        hideTeachers: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        hideTime: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        beforeNotif: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        nowNotif: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        ignoreLinks: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
    }, {
        createdAt: true,
        updatedAt: true,
        sequelize
    })
}