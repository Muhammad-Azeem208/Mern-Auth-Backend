import mongoose from "mongoose";

const dbConnection = ()=>{
    mongoose.connect(process.env.MONGO_URI,{
        dbName: 'Authentication'
    }).then(()=>{
        console.log('Database connected.');
    }).catch((err)=>{
        console.log(`Error Occured while connecting to database: ${err}`);
    });
}

export default dbConnection;