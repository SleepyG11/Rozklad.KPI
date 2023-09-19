import { Model, DataTypes } from "sequelize";

export class Name extends Model{}

export default function nameInit(sequelize){
    return Name.init({
        name: {
            type: DataTypes.TEXT,
            primaryKey: true,
        },
        createdAt: {
            type: DataTypes.DATE,
        },
    }, {
        createdAt: true,
        updatedAt: false,
        sequelize
    })
}