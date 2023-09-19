import { Model, DataTypes } from "sequelize";

export class Schedule extends Model{}

export default function scheduleInit(sequelize){
    return Schedule.init({
        uuid: {
            type: DataTypes.UUID,
            primaryKey: true
        },
        name: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        parent: {
            type: DataTypes.TEXT,
        },
        data: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: true
        },
        createdAt: {
            type: DataTypes.DATE,
        },
        updatedAt: {
            type: DataTypes.DATE,
        }
    }, {
        createdAt: true,
        updatedAt: true,
        sequelize
    })
}