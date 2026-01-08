const mongoose = require("mongoose");

const withTransaction = async (handler) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const result = await handler(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

module.exports = withTransaction;
