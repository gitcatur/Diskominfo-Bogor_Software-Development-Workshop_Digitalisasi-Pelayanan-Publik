const { Sequelize, DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");

// Load our custom pg wrapper
const pgWrapper = require("./pg-wrapper");
const vercelDb = require("./vercel-db");

// Create Sequelize instance with proper SSL configuration for Render
let sequelize;

try {
  // Detect database provider
  const databaseUrl = process.env.DATABASE_URL;
  const isVercelProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const isSupabaseDatabase = databaseUrl && (databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com'));
  const isRenderDatabase = databaseUrl && databaseUrl.includes('render.com');

  if (isVercelProduction) {
    console.log(
      "🚀 Running in Vercel production environment, using optimized configuration"
    );
    sequelize = vercelDb.createVercelSequelize(databaseUrl);
  } else {
    console.log("🏠 Running in local/development environment");

    // Ensure pg package is available
    if (!pgWrapper.isAvailable()) {
      throw new Error(
        "PostgreSQL driver (pg) is required but not available. Please ensure pg package is installed."
      );
    }

    console.log("✅ pg package is available and ready to use");

    // Provider-specific SSL configurations
    let dialectOptions = {};

    if (isSupabaseDatabase) {
      console.log("🔗 Configuring for Supabase PostgreSQL");
      dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };
    } else if (isRenderDatabase) {
      console.log("🔗 Configuring for Render PostgreSQL");
      dialectOptions = {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      };
    } else {
      console.log("🔗 Configuring for local PostgreSQL");
      // No SSL required for local development
      dialectOptions = {};
    }

    sequelize = new Sequelize(databaseUrl, {
      dialect: "postgres",
      dialectOptions,
      logging: process.env.NODE_ENV === "development" ? console.log : false,
      underscored: true, // Force snake_case for all columns globally
      pool: {
        max: isSupabaseDatabase || isRenderDatabase ? 10 : 5, // Higher pool for cloud databases
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      // Additional options for better connection handling
      retry: {
        max: 5, // Increased retries for cloud databases
        timeout: 15000, // Increased timeout for cloud databases
      },
      // Provider-specific optimizations
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true, // Prevent pluralization issues
      },
    });
  }
} catch (error) {
  console.error("Failed to create Sequelize instance:", error);
  throw error;
}

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);

// Define Submission model
const Submission = sequelize.define(
  "Submission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tracking_code: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    nama: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nik: {
      type: DataTypes.STRING(16),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    no_wa: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    jenis_layanan: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("PENGAJUAN_BARU", "DIPROSES", "SELESAI", "DITOLAK"),
      defaultValue: "PENGAJUAN_BARU",
      allowNull: false,
    },
  },
  {
    tableName: "submissions",
    timestamps: true, // Enable automatic timestamp columns
    createdAt: "created_at", // Map to database column name
    updatedAt: "updated_at", // Map to database column name
  }
);

// Define NotificationLog model
const NotificationLog = sequelize.define(
  "NotificationLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    submission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "submissions",
        key: "id",
      },
    },
    channel: {
      type: DataTypes.ENUM("WHATSAPP", "EMAIL"),
      allowNull: false,
    },
    send_status: {
      type: DataTypes.ENUM("SUCCESS", "FAILED"),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    tableName: "notification_logs",
    timestamps: true, // Re-enabled for automatic timestamp columns
    createdAt: "created_at", // Map to database column name
    updatedAt: false, // Only track creation time
  }
);

// Define Admin model
const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
  },
  {
    tableName: "admins",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

const hashPassword = async (admin) => {
  if (!admin.changed("password")) {
    return;
  }

  const saltRounds = Number.isNaN(SALT_ROUNDS) ? 10 : SALT_ROUNDS;
  admin.password = await bcrypt.hash(admin.password, saltRounds);
};

Admin.addHook("beforeCreate", hashPassword);
Admin.addHook("beforeUpdate", hashPassword);

// Define relationships
Submission.hasMany(NotificationLog, { foreignKey: "submission_id" });
NotificationLog.belongsTo(Submission, { foreignKey: "submission_id" });

// Helper function to safely add timestamp columns to existing tables
const safelyAddTimestampColumns = async (queryInterface, tableName, hasUpdatedAt = true) => {
  try {
    const tableDefinition = await queryInterface.describeTable(tableName);

    // Handle created_at column
    if (!tableDefinition.created_at) {
      console.log(`📅 Adding created_at column to ${tableName} with safe migration for existing data`);

      try {
        // Step 1: Add the column as nullable with a default value
        await queryInterface.addColumn(tableName, "created_at", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });

        // Step 2: Update existing null values with current timestamp
        const [results] = await sequelize.query(
          `UPDATE "${tableName}" SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;`
        );
        console.log(`✅ Updated ${results?.rowCount || 0} rows with created_at timestamps`);

        // Step 3: Now make the column NOT NULL
        await queryInterface.changeColumn(tableName, "created_at", {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });
        console.log(`✅ Successfully added created_at column to ${tableName}`);

      } catch (columnError) {
        // Handle specific errors for column creation
        if (columnError?.original?.code === "42701") {
          console.log(`ℹ️ created_at column already exists in ${tableName}, skipping creation`);
        } else if (columnError?.original?.code === "23502") {
          console.log(`⚠️ NOT NULL constraint issue for created_at in ${tableName}, attempting fix...`);

          // Try to fix existing null values and then add constraint
          await sequelize.query(
            `UPDATE "${tableName}" SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;`
          );

          // Retry making it NOT NULL
          await queryInterface.changeColumn(tableName, "created_at", {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          });
        } else {
          throw columnError;
        }
      }
    } else {
      console.log(`✅ created_at column already exists in ${tableName}`);
    }

    // Handle updated_at column (only if the model uses it)
    if (hasUpdatedAt && !tableDefinition.updated_at) {
      console.log(`📅 Adding updated_at column to ${tableName} with safe migration for existing data`);

      try {
        // Step 1: Add the column as nullable with a default value
        await queryInterface.addColumn(tableName, "updated_at", {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });

        // Step 2: Update existing null values with current timestamp
        const [results] = await sequelize.query(
          `UPDATE "${tableName}" SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`
        );
        console.log(`✅ Updated ${results?.rowCount || 0} rows with updated_at timestamps`);

        // Step 3: Now make the column NOT NULL
        await queryInterface.changeColumn(tableName, "updated_at", {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        });
        console.log(`✅ Successfully added updated_at column to ${tableName}`);

      } catch (columnError) {
        // Handle specific errors for column creation
        if (columnError?.original?.code === "42701") {
          console.log(`ℹ️ updated_at column already exists in ${tableName}, skipping creation`);
        } else if (columnError?.original?.code === "23502") {
          console.log(`⚠️ NOT NULL constraint issue for updated_at in ${tableName}, attempting fix...`);

          // Try to fix existing null values and then add constraint
          await sequelize.query(
            `UPDATE "${tableName}" SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL;`
          );

          // Retry making it NOT NULL
          await queryInterface.changeColumn(tableName, "updated_at", {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          });
        } else {
          throw columnError;
        }
      }
    } else if (hasUpdatedAt) {
      console.log(`✅ updated_at column already exists in ${tableName}`);
    }

  } catch (tableError) {
    if (tableError?.original?.code === "42P01") {
      console.log(`ℹ️ ${tableName} table does not exist yet, skipping timestamp column checks`);
    } else {
      console.warn(`⚠️ Could not ensure timestamp columns on ${tableName} table:`, tableError.message);
      // Don't throw here, let the sync process handle table creation
    }
  }
};

// Detect database provider for provider-specific optimizations
const detectDatabaseProvider = (databaseUrl) => {
  if (!databaseUrl) return 'unknown';

  if (databaseUrl.includes('supabase.co') || databaseUrl.includes('supabase.com')) {
    return 'supabase';
  } else if (databaseUrl.includes('render.com')) {
    return 'render';
  } else if (databaseUrl.includes('vercel')) {
    return 'vercel';
  }

  return 'unknown';
};

// Initialize database with retry logic
const initializeDatabase = async (retries = 3) => {
  try {
    console.log("Attempting to connect to database...");
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    const queryInterface = sequelize.getQueryInterface();
    const databaseProvider = detectDatabaseProvider(process.env.DATABASE_URL);
    console.log(`Detected database provider: ${databaseProvider}`);

    // Safely add timestamp columns to existing tables before sync
    await safelyAddTimestampColumns(queryInterface, "submissions", true);
    await safelyAddTimestampColumns(queryInterface, "notification_logs", false); // NotificationLog only has created_at
    await safelyAddTimestampColumns(queryInterface, "admins", true);

    // Only sync in development, not in production
    if (process.env.NODE_ENV === "development" || process.env.VERCEL !== "1") {
      console.log(
        "Development environment detected, synchronizing database models..."
      );

      // Use a safer sync approach that doesn't aggressively alter existing data
      await sequelize.sync({
        alter: {
          drop: false, // Never drop columns
        }
      });
      console.log("Database models synchronized.");
    } else {
      console.log(
        "Production environment detected, skipping database sync to prevent schema conflicts."
      );
      console.log(
        "Database tables should already exist and be properly configured."
      );
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);

    if (retries > 0) {
      console.log(`Retrying connection... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
      return initializeDatabase(retries - 1);
    }

    console.error("Max retries reached. Exiting...");
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  Submission,
  NotificationLog,
  Admin,
  initializeDatabase,
};
