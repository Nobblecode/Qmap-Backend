const NotificationModel = require("../models/general/Notification.model");

// Function to create a notification
const createNotification = async (userId, message) => {
  try {
    const notification = await NotificationModel.create({
      User_id: userId,
      Message: message,
      createdAt: new Date(),
    });
    console.log("Notification created successfully:", notification);
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Export the functions for use in routes
module.exports = {
  createNotification,
};
