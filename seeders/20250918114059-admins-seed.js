"use strict";

const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

const DEFAULT_PASSWORD = "admin123";
const ADMIN_TOTAL = 10;
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

module.exports = {
  async up(queryInterface, Sequelize) {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    const timestamp = new Date();

    const admins = Array.from({ length: ADMIN_TOTAL }, (_, index) => ({
      id: uuidv4(),
      username: `admin${index + 1}`,
      email: `admin${index + 1}@example.com`,
      password: passwordHash,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    await queryInterface.bulkInsert("admins", admins, {});
  },

  async down(queryInterface, Sequelize) {
    const usernames = Array.from(
      { length: ADMIN_TOTAL },
      (_, index) => `admin${index + 1}`
    );

    await queryInterface.bulkDelete(
      "admins",
      {
        username: {
          [Sequelize.Op.in]: usernames,
        },
      },
      {}
    );
  },
};
