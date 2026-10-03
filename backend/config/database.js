import mongoose from 'mongoose';

export async function connectDB(uri) {
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}

export default connectDB;