import { Model, DataTypes } from "sequelize";

export class Variable extends Model{}

export default function variableInit(sequelize){
    return Variable.init({
        key: {
            type: DataTypes.TEXT,
            primaryKey: true,
        },
        intValue: {
            type: DataTypes.INTEGER,
        },
        stringValue: {
            type: DataTypes.TEXT
        },
        booleanValue: {
            type: DataTypes.BOOLEAN
        }
    }, {
        sequelize
    })
}